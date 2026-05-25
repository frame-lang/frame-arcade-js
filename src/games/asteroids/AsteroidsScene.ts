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
  private rocks: Phaser.GameObjects.Arc[] = [];     // pool synced to m.field
  private shots: Phaser.GameObjects.Arc[] = [];
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
    this.ship = this.add.triangle(W / 2, H / 2, 0, -12, -9, 10, 9, 10, 0x8ab4f8);
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
      const b = this.add.circle(this.ship.x, this.ship.y, 3, 0xffffff);
      (b as unknown as { vx: number }).vx = Math.sin(this.ship.rotation) * BULLET + this.svx;
      (b as unknown as { vy: number }).vy = -Math.cos(this.ship.rotation) * BULLET + this.svy;
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
      // Reset the ship transform the moment it returns to play after dying.
      if (this.m.ship.get_state() === "respawning" && this.prevShip !== "respawning") this.resetShip();
      this.prevShip = this.m.ship.get_state();

      if (st === "playing") {
        this.flyShip(dt);
        this.updateBullets(dt);
        this.checkCollisions();
      }
    }

    this.renderRocks(s);
    this.ship.setVisible(s !== "attract" && s !== "game_over" && this.m.ship.is_visible());
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

  // Sync the Arc pool to the machine's field and draw each alive asteroid.
  private renderRocks(s: string): void {
    const showField = s === "playing" || s === "ship_dying" || s === "wave_clear" || s === "paused";
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
