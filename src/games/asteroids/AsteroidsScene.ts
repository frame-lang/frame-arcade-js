import Phaser from "phaser";

/**
 * Public surface of the canonical Asteroids machine (mirrors the Godot
 * reference, ch04-asteroids). The machine owns the Ship modes and the
 * AsteroidField (positions/velocities/splitting); this scene is a thin
 * driver like Godot main.gd — it owns only the ship's transform + bullets,
 * ticks the machine with the court size, renders asteroids from m.field,
 * and reports collisions (ship_hit_asteroid / bullet_hit_asteroid) and
 * hyperspace.
 */
interface ShipSub {
  get_state(): string;
  is_visible(): boolean;
  can_fire(): boolean;
}
interface FieldSub {
  count(): number;
  is_alive(index: number): boolean;
  position(index: number): { x: number; y: number };
  radius_of(index: number): number;
}
export interface AsteroidsMachine {
  start(): void;
  restart(): void;
  pause(): void;
  resume(): void;
  tick(dt: number, court_size: { x: number; y: number }): void;
  ship_hit_asteroid(index: number): void;
  bullet_hit_asteroid(index: number): void;
  ship_hyperspace(): void;
  current_state(): string;
  get_state(): string;
  get_score(): number;
  get_lives(): number;
  get_wave(): number;
  is_paused(): boolean;
  ship: ShipSub;
  field: FieldSub;
}

const W = 720;
const H = 480;
const THRUST = 260;
const TURN = 4.2;
const FRICTION = 0.6;
const BULLET = 460;
const COURT = { x: W, y: H };

export class AsteroidsScene extends Phaser.Scene {
  private m: AsteroidsMachine;
  private ship!: Phaser.GameObjects.Triangle;
  private flame!: Phaser.GameObjects.Triangle;     // thrust flame, behind the ship
  private rocks: Phaser.GameObjects.Polygon[] = [];   // pool synced to m.field
  private rockShapes: number[][] = [];                // jittered unit-radius polygons, cycled by index
  private shots: Phaser.GameObjects.Arc[] = [];
  private fragments: { line: Phaser.GameObjects.Line; vx: number; vy: number; age: number }[] = [];
  private svx = 0;
  private svy = 0;
  private fireCool = 0;
  private prevShip = "";
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor(machine: AsteroidsMachine) {
    super("Asteroids");
    this.m = machine;
  }

  create(): void {
    // Triangle vertices chosen so the centroid sits at local (0, 0). But
    // Phaser's Shape rotates around displayOrigin (= origin * size, where
    // size = max-of-vertex-coords, not the bounding box), so we ALSO need
    // setOrigin(0, 0) to force displayOrigin to (0, 0). Together those make
    // rotation pivot the centroid + put the nose vertex on the rotation
    // axis so bullets fire down the centerline.
    this.ship = this.add
      .triangle(W / 2, H / 2, 0, -14, -9, 7, 9, 7, 0x8ab4f8)
      .setOrigin(0, 0);
    // Thrust flame: a small triangle trailing the ship, sharing the ship's
    // pivot + rotation. Its local vertices point "down" (positive y) so it
    // emerges from the rear when the ship rotates. Hidden unless UP is held.
    this.flame = this.add
      .triangle(W / 2, H / 2, 0, 14, -3, 7, 3, 7, 0xffae42)
      .setOrigin(0, 0)
      .setVisible(false);

    // Pre-generate a handful of jittered unit-radius polygon outlines for
    // the asteroids — each rock instance picks one by index and scales it
    // to radius_of(i) at render time. Seeded so the shapes are stable
    // across page reloads.
    let seed = 0xa5be0d;
    const rand = (): number => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let k = 0; k < 5; k++) {
      const sides = 9 + Math.floor(rand() * 3); // 9-11 sides
      const pts: number[] = [];
      for (let j = 0; j < sides; j++) {
        const angle = (j / sides) * Math.PI * 2;
        const r = 0.78 + rand() * 0.34; // 0.78-1.12 jitter for that rocky look
        pts.push(Math.cos(angle) * r, Math.sin(angle) * r);
      }
      this.rockShapes.push(pts);
    }

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H - 22, "", { ...mono, fontSize: "14px", color: "#9aa4b8" }).setOrigin(0.5);
    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,UP") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-H", () => this.onHyper());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onSpace(): void {
    const s = this.m.get_state();
    if (s === "attract") { this.m.start(); this.resetShip(); }
    else if (s === "game_over") this.m.restart();
    else if (s === "playing" && this.m.ship.can_fire() && this.fireCool <= 0) {
      this.fireCool = 0.22;
      // Spawn at the nose tip. With the centroid-at-origin triangle the nose
      // vertex is at local (0, -14), so the muzzle is 14px forward along the
      // ship's heading — and the spawn is on the rotation pivot's center
      // line, so it stays on-axis at every rotation.
      const fx = Math.sin(this.ship.rotation);
      const fy = -Math.cos(this.ship.rotation);
      const b = this.add.circle(this.ship.x + fx * 14, this.ship.y + fy * 14, 3, 0xffffff);
      (b as unknown as { vx: number }).vx = fx * BULLET + this.svx;
      (b as unknown as { vy: number }).vy = fy * BULLET + this.svy;
      this.shots.push(b);
    }
  }

  private onHyper(): void {
    if (this.m.get_state() === "playing") {
      this.m.ship_hyperspace();
      this.ship.setPosition(Phaser.Math.Between(40, W - 40), Phaser.Math.Between(40, H - 40));
      this.svx = 0;
      this.svy = 0;
    }
  }

  private onPause(): void {
    if (this.m.is_paused()) this.m.resume();
    else if (this.m.get_state() === "playing" || this.m.get_state() === "ship_dying") this.m.pause();
  }

  private resetShip(): void {
    this.ship.setPosition(W / 2, H / 2);
    this.ship.rotation = 0;
    this.svx = 0;
    this.svy = 0;
    this.shots.forEach((b) => b.destroy());
    this.shots = [];
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.get_state();
    this.fireCool = Math.max(0, this.fireCool - dt);

    if (!this.m.is_paused() && s !== "attract" && s !== "game_over") {
      this.m.tick(dt, COURT);
      const st = this.m.get_state();
      const shipNow = this.m.ship.get_state();
      // Reset the ship transform the moment it returns to play after dying.
      if (shipNow === "respawning" && this.prevShip !== "respawning") this.resetShip();
      // Spawn the explosion fragments the moment the ship enters Exploding;
      // the FSM stays in Exploding for 1.0s, the fragments fade out over the
      // same window and clean themselves up.
      if (shipNow === "exploding" && this.prevShip !== "exploding") {
        this.spawnExplosion(this.ship.x, this.ship.y);
      }
      this.prevShip = shipNow;
      this.updateFragments(dt);

      if (st === "playing") {
        this.flyShip(dt);
        this.updateBullets(dt);
        this.checkCollisions();
      }
    }

    this.renderRocks(s);
    // Hide the ship sprite during Exploding so the fragments tell the story —
    // the FSM's is_visible() reports true during Exploding (the ship's debris
    // IS visually present), but the triangle itself shouldn't sit there frozen.
    this.ship.setVisible(
      s !== "attract" &&
        s !== "game_over" &&
        this.m.ship.is_visible() &&
        this.m.ship.get_state() !== "exploding",
    );
    // Respawn invulnerability: blink the ship at ~6 Hz so it's clear it can't
    // be hit. Reset to full opacity outside Respawning.
    this.ship.setAlpha(
      this.m.ship.get_state() === "respawning" && (Math.floor(performance.now() / 90) & 1) === 0
        ? 0.35
        : 1,
    );
    // Flame: only while actively thrusting in Playing.
    this.updateFlame(s === "playing" && this.keys.UP.isDown);
    this.scoreText.setText(`score ${this.m.get_score()}   ships ${this.m.get_lives()}   wave ${this.m.get_wave()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private flyShip(dt: number): void {
    if (this.keys.LEFT.isDown) this.ship.rotation -= TURN * dt;
    if (this.keys.RIGHT.isDown) this.ship.rotation += TURN * dt;
    if (this.keys.UP.isDown) {
      this.svx += Math.sin(this.ship.rotation) * THRUST * dt;
      this.svy += -Math.cos(this.ship.rotation) * THRUST * dt;
    }
    this.svx *= 1 - FRICTION * dt;
    this.svy *= 1 - FRICTION * dt;
    this.ship.x = Phaser.Math.Wrap(this.ship.x + this.svx * dt, 0, W);
    this.ship.y = Phaser.Math.Wrap(this.ship.y + this.svy * dt, 0, H);
  }

  // Flame trails the ship at the same pivot + rotation; flickers width/length
  // a touch each frame for that classic 8-bit thruster feel.
  private updateFlame(visible: boolean): void {
    this.flame.setVisible(visible && this.m.ship.is_visible());
    if (!visible) return;
    this.flame.x = this.ship.x;
    this.flame.y = this.ship.y;
    this.flame.rotation = this.ship.rotation;
    this.flame.setScale(0.85 + Math.random() * 0.3);
  }

  private updateBullets(dt: number): void {
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i] as unknown as Phaser.GameObjects.Arc & { vx: number; vy: number; life?: number };
      b.x = Phaser.Math.Wrap(b.x + b.vx * dt, 0, W);
      b.y = Phaser.Math.Wrap(b.y + b.vy * dt, 0, H);
      b.life = (b.life ?? 0) + dt;
      if (b.life > 1.1) { b.destroy(); this.shots.splice(i, 1); }
    }
  }

  private checkCollisions(): void {
    const n = this.m.field.count();
    // bullets vs asteroids
    for (let bi = this.shots.length - 1; bi >= 0; bi--) {
      const b = this.shots[bi];
      for (let i = 0; i < n; i++) {
        if (!this.m.field.is_alive(i)) continue;
        const p = this.m.field.position(i);
        if (Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) < this.m.field.radius_of(i)) {
          this.m.bullet_hit_asteroid(i);
          b.destroy();
          this.shots.splice(bi, 1);
          break;
        }
      }
    }
    // ship vs asteroids (the machine ignores the hit if the ship can't be hit)
    for (let i = 0; i < n; i++) {
      if (!this.m.field.is_alive(i)) continue;
      const p = this.m.field.position(i);
      if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, p.x, p.y) < this.m.field.radius_of(i) + 8) {
        this.m.ship_hit_asteroid(i);
        break;
      }
    }
  }

  // Sync the polygon pool to the machine's field and draw each alive
  // asteroid. The polygons are unit-radius outlines cycled by index; setScale
  // grows each to the actual radius reported by the field.
  private renderRocks(s: string): void {
    const showField = s === "playing" || s === "ship_dying" || s === "wave_clear" || s === "paused";
    const n = this.m.field.count();
    while (this.rocks.length < n) {
      const shape = this.rockShapes[this.rocks.length % this.rockShapes.length];
      this.rocks.push(
        this.add
          .polygon(0, 0, shape, 0x9aa4b8, 0)
          .setStrokeStyle(2, 0x9aa4b8)
          .setOrigin(0.5, 0.5),
      );
    }
    for (let i = 0; i < this.rocks.length; i++) {
      const alive = showField && i < n && this.m.field.is_alive(i);
      this.rocks[i].setVisible(alive);
      if (alive) {
        const p = this.m.field.position(i);
        this.rocks[i].setPosition(p.x, p.y).setScale(this.m.field.radius_of(i));
      }
    }
  }

  // Explosion fragments — short line segments shooting outward from the ship
  // position, fading over ~1s (matching the $Exploding duration).
  private spawnExplosion(x: number, y: number): void {
    const n = 10;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const speed = 60 + Math.random() * 90;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const len = 5 + Math.random() * 7;
      const ax = -Math.cos(angle) * len * 0.5;
      const ay = -Math.sin(angle) * len * 0.5;
      const bx = Math.cos(angle) * len * 0.5;
      const by = Math.sin(angle) * len * 0.5;
      const line = this.add.line(x, y, ax, ay, bx, by, 0x8ab4f8).setLineWidth(1.5);
      this.fragments.push({ line, vx, vy, age: 0 });
    }
  }

  private updateFragments(dt: number): void {
    for (let i = this.fragments.length - 1; i >= 0; i--) {
      const f = this.fragments[i];
      f.age += dt;
      f.line.x = Phaser.Math.Wrap(f.line.x + f.vx * dt, 0, W);
      f.line.y = Phaser.Math.Wrap(f.line.y + f.vy * dt, 0, H);
      f.line.setAlpha(Math.max(0, 1 - f.age));
      if (f.age >= 1.0) {
        f.line.destroy();
        this.fragments.splice(i, 1);
      }
    }
  }

  private hint(s: string): string {
    switch (s) {
      case "attract": return "SPACE to start";
      case "playing": return "←/→ turn  ·  ↑ thrust  ·  SPACE fire  ·  H hyperspace  ·  P pause";
      case "ship_dying": return "";
      case "wave_clear": return "Wave clear!";
      case "paused": return "P to resume";
      case "game_over": return "Game over  ·  SPACE to restart";
      default: return "";
    }
  }
}
