import Phaser from "phaser";

export interface AsteroidsMachine {
  start(): void;
  hyperspace(): void;
  arrive(): void;
  rock_destroyed(): void;
  hit(): void;
  next(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  score(): number;
  lives(): number;
  rocks(): number;
}

const W = 720;
const H = 480;
const THRUST = 260;
const TURN = 4.2;
const FRICTION = 0.6;
const BULLET = 460;

interface Rock { obj: Phaser.GameObjects.Arc; vx: number; vy: number; }

export class AsteroidsScene extends Phaser.Scene {
  private m: AsteroidsMachine;
  private ship!: Phaser.GameObjects.Triangle;
  private rocks: Rock[] = [];
  private shots: Phaser.GameObjects.Arc[] = [];
  private svx = 0;
  private svy = 0;
  private fireCool = 0;
  private hyperTimer = 0;
  private invuln = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private prev = "";

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
    const s = this.m.current_state();
    if (s === "Title") { this.m.start(); this.spawnField(); }
    else if (s === "Cleared") this.m.next();
    else if (s === "GameOver") { this.m.restart(); }
    else if (s === "Flying" && this.fireCool <= 0) {
      this.fireCool = 0.22;
      const b = this.add.circle(this.ship.x, this.ship.y, 3, 0xffffff);
      (b as any).vx = Math.sin(this.ship.rotation) * BULLET + this.svx;
      (b as any).vy = -Math.cos(this.ship.rotation) * BULLET + this.svy;
      this.shots.push(b);
    }
  }
  private onHyper(): void {
    if (this.m.current_state() === "Flying") {
      this.m.hyperspace();
      this.ship.setPosition(Phaser.Math.Between(40, W - 40), Phaser.Math.Between(40, H - 40));
      this.svx = 0; this.svy = 0;
      this.hyperTimer = 0.6;
      this.invuln = 1.2;
    }
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Flying" || s === "Cleared") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  private spawnField(): void {
    this.rocks.forEach((r) => r.obj.destroy());
    this.rocks = [];
    for (let i = 0; i < this.m.rocks(); i++) {
      const x = Phaser.Math.Between(0, W), y = Phaser.Math.Between(0, H);
      if (Phaser.Math.Distance.Between(x, y, W / 2, H / 2) < 90) { i--; continue; }
      const obj = this.add.circle(x, y, Phaser.Math.Between(14, 24), 0x9aa4b8, 0).setStrokeStyle(2, 0x9aa4b8);
      this.rocks.push({ obj, vx: Phaser.Math.FloatBetween(-60, 60), vy: Phaser.Math.FloatBetween(-60, 60) });
    }
    this.ship.setPosition(W / 2, H / 2);
    this.svx = 0; this.svy = 0;
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);
    const s = this.m.current_state();
    this.fireCool -= dt;
    if (this.invuln > 0) this.invuln -= dt;

    if (s === "Hyperspace") {
      this.hyperTimer -= dt;
      this.ship.setAlpha(0.3);
      if (this.hyperTimer <= 0) this.m.arrive();
    } else {
      this.ship.setAlpha(this.invuln > 0 ? 0.5 : 1);
    }

    if (s === "Flying") this.stepFlying(dt);
    if (s === "Flying" || s === "Hyperspace") this.driftRocks(dt);

    this.scoreText.setText(`score ${this.m.score()}   ships ${this.m.lives()}   rocks ${this.m.rocks()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
    this.prev = s;
  }

  private stepFlying(dt: number): void {
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

    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i] as any;
      b.x = Phaser.Math.Wrap(b.x + b.vx * dt, 0, W);
      b.y = Phaser.Math.Wrap(b.y + b.vy * dt, 0, H);
      b.life = (b.life ?? 1.2) - dt;
      let hitRock = false;
      for (let j = this.rocks.length - 1; j >= 0; j--) {
        if (Phaser.Math.Distance.Between(b.x, b.y, this.rocks[j].obj.x, this.rocks[j].obj.y) < this.rocks[j].obj.radius) {
          this.rocks[j].obj.destroy(); this.rocks.splice(j, 1);
          this.m.rock_destroyed();
          hitRock = true;
          break;
        }
      }
      if (hitRock || b.life <= 0) { b.destroy(); this.shots.splice(i, 1); }
    }

    if (this.invuln <= 0) {
      for (const r of this.rocks) {
        if (Phaser.Math.Distance.Between(this.ship.x, this.ship.y, r.obj.x, r.obj.y) < r.obj.radius + 8) {
          this.m.hit();
          this.ship.setPosition(W / 2, H / 2);
          this.svx = 0; this.svy = 0;
          this.invuln = 1.5;
          break;
        }
      }
    }
  }

  private driftRocks(dt: number): void {
    for (const r of this.rocks) {
      r.obj.x = Phaser.Math.Wrap(r.obj.x + r.vx * dt, 0, W);
      r.obj.y = Phaser.Math.Wrap(r.obj.y + r.vy * dt, 0, H);
    }
  }

  private hint(s: string): string {
    switch (s) {
      case "Title": return "SPACE to start";
      case "Flying": return "←/→ turn · ↑ thrust · SPACE fire · H hyperspace · P pause";
      case "Hyperspace": return "...jumping through hyperspace...";
      case "Cleared": return "Field cleared! · SPACE for next";
      case "Paused": return "P to resume";
      case "GameOver": return "Game over · SPACE to restart";
      default: return "";
    }
  }
}
