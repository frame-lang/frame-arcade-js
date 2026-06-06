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
  get_current_state_name(): string;
  is_visible(): boolean;
  can_fire(): boolean;
  fire(): void;
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
  get_current_state_name(): string;
  get_score(): number;
  get_lives(): number;
  get_wave(): number;
  get_difficulty(): number;
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
  private rocks: Phaser.GameObjects.Arc[] = [];     // pool synced to m.field
  private shots: Phaser.GameObjects.Arc[] = [];
  private fragments: { line: Phaser.GameObjects.Line; vx: number; vy: number; age: number }[] = [];
  private svx = 0;
  private svy = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;

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

    // HUD mirrors Godot main.gd's label layout: SCORE / LIVES / WAVE / DIFF
    // across the top; big centered text for Attract / WaveClear / Paused /
    // GameOver messaging. The small per-state hint that used to live at the
    // bottom is gone — its job is now the centerText overlay.
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "16px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.centerText = this.add
      .text(W / 2, H * 0.4, "", { ...mono, fontSize: "26px", align: "center" })
      .setOrigin(0.5, 0);
    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,UP") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-H", () => this.onHyper());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
    // Match Godot: R restarts from $GameOver; any key starts from $Attract.
    this.input.keyboard!.on("keydown-R", () => this.onR());
    this.input.keyboard!.on("keydown", () => this.onAnyKey());
  }

  private onSpace(): void {
    const s = this.m.get_current_state_name();
    if (s === "Playing" && this.m.ship.can_fire()) {
      // The FSM owns the cooldown — fire() resets Ship.$Alive's $.cooldown
      // state-local; can_fire() above already reflects whether we're past
      // it. After this, can_fire() returns false until tick() drains
      // the cooldown back to zero.
      this.m.ship.fire();
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
    // Just ask the FSM. Ship.$Alive.hyperspace() transitions to
    // $InHyperspace, whose $>() handler calls our warp_out() host method
    // to randomise position + zero velocity. The scene doesn't need to
    // know what "hyperspace" means visually — Frame already announced it.
    if (this.m.get_current_state_name() === "Playing") {
      this.m.ship_hyperspace();
    }
  }

  private onPause(): void {
    if (this.m.is_paused()) this.m.resume();
    else if (this.m.get_current_state_name() === "Playing" || this.m.get_current_state_name() === "ShipDying") this.m.pause();
  }

  // R restarts from $GameOver (matches Godot's KEY_R handler). Any other
  // state ignores R, which means R during gameplay is a no-op — same as
  // Godot.
  private onR(): void {
    if (this.m.get_current_state_name() === "GameOver") this.m.restart();
  }

  // Any key advances $Attract → $Playing (matches Godot's
  // Input.is_anything_pressed() check in the Attract branch). Wired to
  // the generic "keydown" event so SPACE, arrows, H, P, R, etc. all start
  // the game from the attract screen.
  private onAnyKey(): void {
    if (this.m.get_current_state_name() === "Attract") this.m.start();
  }

  // -------- ShipHost surface --------
  // Public methods called from Ship's $> / <$ handlers via the host proxy
  // wired in src/game.ts. Each is a one-shot effect at a state boundary;
  // continuous queries (is_visible, can_fire, …) stay on the FSM interface
  // and are polled per-frame from update().

  /** $Exploding.$>() — scatter debris from the ship's last position. */
  spawn_explosion(): void {
    this.spawnExplosion(this.ship.x, this.ship.y);
  }

  /** $Respawning.$>() — recentre the ship, zero its velocity, clear bullets. */
  reset_ship(): void {
    this.ship.setPosition(W / 2, H / 2);
    this.ship.rotation = 0;
    this.svx = 0;
    this.svy = 0;
    this.shots.forEach((b) => b.destroy());
    this.shots = [];
  }

  /** $InHyperspace.$>() — pick a fresh location for the re-emergence. */
  warp_out(): void {
    this.ship.setPosition(
      Phaser.Math.Between(40, W - 40),
      Phaser.Math.Between(40, H - 40),
    );
    this.svx = 0;
    this.svy = 0;
  }

  /** $InHyperspace.<$() — no-op for now; reserve for a re-entry flash. */
  warp_in(): void {
    // Intentionally empty — the visible blink-in is just the sprite becoming
    // is_visible() === true again on the next frame.
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.get_current_state_name();

    if (!this.m.is_paused() && s !== "Attract" && s !== "GameOver") {
      // Drive the FSM. Discrete moments (the ship entering $Exploding /
      // $Respawning / $InHyperspace) are now announced by Frame's $> / <$
      // handlers calling back into our host methods below — no prev/curr
      // polling on the scene side. The scene's only contract with the FSM
      // for these is to *implement* the host methods correctly.
      this.m.tick(dt, COURT);
      const st = this.m.get_current_state_name();
      this.updateFragments(dt);

      if (st === "Playing") {
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
      s !== "Attract" &&
        s !== "GameOver" &&
        this.m.ship.is_visible() &&
        this.m.ship.get_current_state_name() !== "Exploding",
    );
    // Respawn invulnerability: blink the ship at ~6 Hz so it's clear it can't
    // be hit. Reset to full opacity outside Respawning.
    this.ship.setAlpha(
      this.m.ship.get_current_state_name() === "Respawning" && (Math.floor(performance.now() / 90) & 1) === 0
        ? 0.35
        : 1,
    );
    // Flame: only while actively thrusting in Playing.
    this.updateFlame(s === "Playing" && this.keys.UP.isDown);
    // Same HUD layout as the Godot driver — SCORE / LIVES / WAVE / DIFF
    // across the top, zero-padded score so the column doesn't jitter.
    const score = this.m.get_score().toString().padStart(5, "0");
    this.scoreText.setText(
      `SCORE ${score}   LIVES ${this.m.get_lives()}   WAVE ${this.m.get_wave()}   DIFF ${this.m.get_difficulty()}`,
    );
    this.stateText.setText(`state: ${s}`);
    this.centerText.setText(this.centerMessage(s));
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
    // Bullets vs asteroids: pure radial check (bullet's 3px disc vs each
    // asteroid's circle at radius_of). Bullet treated as a 3-radius circle,
    // not a point — touching the edge counts as a hit.
    const BULLET_R = 3;
    for (let bi = this.shots.length - 1; bi >= 0; bi--) {
      const b = this.shots[bi];
      for (let i = 0; i < n; i++) {
        if (!this.m.field.is_alive(i)) continue;
        const p = this.m.field.position(i);
        if (
          Phaser.Math.Distance.Between(b.x, b.y, p.x, p.y) <
          this.m.field.radius_of(i) + BULLET_R
        ) {
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

  // Sync the circle pool to the machine's field and draw each alive
  // asteroid. add.circle creates an Arc centered on its position — so the
  // visual center sits exactly at (p.x, p.y), matching the radial collision
  // check (Phaser.Math.Distance.Between < radius_of) below.
  private renderRocks(s: string): void {
    const showField = s === "Playing" || s === "ShipDying" || s === "WaveClear" || s === "Paused";
    const n = this.m.field.count();
    while (this.rocks.length < n) {
      this.rocks.push(this.add.circle(0, 0, 10, 0x9aa4b8, 0).setStrokeStyle(2, 0x9aa4b8));
    }
    for (let i = 0; i < this.rocks.length; i++) {
      const alive = showField && i < n && this.m.field.is_alive(i);
      this.rocks[i].setVisible(alive);
      if (alive) {
        const p = this.m.field.position(i);
        this.rocks[i].setPosition(p.x, p.y).setRadius(this.m.field.radius_of(i));
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

  // Mirrors main.gd's label_center text per state (Godot ch04-asteroids).
  // Attract advertises the controls; GameOver tells the player to press R
  // (matched by onR() above); Playing leaves the canvas clean.
  private centerMessage(s: string): string {
    switch (s) {
      case "Attract":
        return "A S T E R O I D S\n\nPress any key to start\n(H = hyperspace, P = pause)";
      case "WaveClear": return "WAVE CLEAR";
      case "Paused": return "PAUSED";
      case "GameOver": return "GAME OVER\n\nPress R to restart";
      default: return "";
    }
  }
}
