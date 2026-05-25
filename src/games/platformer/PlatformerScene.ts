import Phaser from "phaser";

export interface PlatformerMachine {
  start(): void;
  run(): void;
  halt(): void;
  jump(): void;
  step_off(): void;
  apex(): void;
  land(): void;
  coin(): void;
  goal(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  coins(): number;
}

const W = 720;
const H = 480;
const RUN = 240;
const JUMP = 560;
const GRAVITY = 1500;
const PW = 22;
const PH = 30;

interface Plat { x: number; y: number; w: number; }

export class PlatformerScene extends Phaser.Scene {
  private m: PlatformerMachine;
  private player!: Phaser.GameObjects.Rectangle;
  private goalFlag!: Phaser.GameObjects.Rectangle;
  private coinObjs: Phaser.GameObjects.Arc[] = [];
  private platforms: Plat[] = [
    { x: 0, y: H - 20, w: W }, // ground
    { x: 180, y: 360, w: 140 },
    { x: 400, y: 290, w: 140 },
    { x: 590, y: 210, w: 120 },
  ];
  private vx = 0;
  private vy = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private prev = "";

  constructor(machine: PlatformerMachine) {
    super("Platformer");
    this.m = machine;
  }

  create(): void {
    for (const p of this.platforms) {
      this.add.rectangle(p.x, p.y, p.w, 12, 0x3a4252).setOrigin(0, 0);
    }
    this.goalFlag = this.add.rectangle(640, 188, 14, 22, 0xfbbc04).setOrigin(0, 0);
    this.player = this.add.rectangle(40, H - 60, PW, PH, 0x8ab4f8);

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, 30, "", { ...mono, fontSize: "15px", color: "#9aa4b8" }).setOrigin(0.5, 0);

    this.keys = this.input.keyboard!.addKeys("A,D,LEFT,RIGHT,W,UP,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
    this.buildCoins();
  }

  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Idle" || s === "Running" || s === "Jumping" || s === "Falling") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  private onSpace(): void {
    const s = this.m.current_state();
    if (s === "Title" || s === "Win") {
      if (s === "Win") this.m.restart();
      else this.m.start();
      this.respawn();
    }
  }

  private respawn(): void {
    this.player.setPosition(40, H - 60);
    this.vx = 0;
    this.vy = 0;
    this.buildCoins();
  }

  private buildCoins(): void {
    this.coinObjs.forEach((c) => c.destroy());
    this.coinObjs = [
      this.add.circle(250, 340, 7, 0xfbbc04),
      this.add.circle(470, 270, 7, 0xfbbc04),
      this.add.circle(650, 190, 7, 0xfbbc04),
    ];
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);
    const s = this.m.current_state();

    if (s !== "Title" && s !== "Win" && s !== "Paused") this.step(dt);

    this.prev = s;
    this.scoreText.setText(`coins ${this.m.coins()} / 3`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private step(dt: number): void {
    const left = this.keys.A.isDown || this.keys.LEFT.isDown;
    const right = this.keys.D.isDown || this.keys.RIGHT.isDown;
    const jumpHeld = this.keys.W.isDown || this.keys.UP.isDown;
    const moving = left !== right;
    this.vx = (right ? RUN : 0) - (left ? RUN : 0);

    const groundedBefore = this.onGround();
    if (jumpHeld && groundedBefore && (this.m.current_state() === "Idle" || this.m.current_state() === "Running")) {
      this.vy = -JUMP;
      this.m.jump();
    }

    this.vy += GRAVITY * dt;
    if (this.m.current_state() === "Jumping" && this.vy >= 0) this.m.apex();

    this.player.x = Phaser.Math.Clamp(this.player.x + this.vx * dt, PW / 2, W - PW / 2);
    this.player.y += this.vy * dt;

    const grounded = this.resolveLanding();

    // reconcile machine locomotion with physics
    const s = this.m.current_state();
    if (grounded) {
      if (s === "Jumping" || s === "Falling") this.m.land();
      const s2 = this.m.current_state();
      if (moving && s2 === "Idle") this.m.run();
      else if (!moving && s2 === "Running") this.m.halt();
    } else if (s === "Idle" || s === "Running") {
      this.m.step_off();
    }

    // coins + goal
    for (let i = this.coinObjs.length - 1; i >= 0; i--) {
      if (Phaser.Math.Distance.Between(this.player.x, this.player.y, this.coinObjs[i].x, this.coinObjs[i].y) < 20) {
        this.coinObjs[i].destroy();
        this.coinObjs.splice(i, 1);
        this.m.coin();
      }
    }
    if (this.player.x + PW / 2 > this.goalFlag.x && this.player.y < 220) this.m.goal();

    if (this.player.y > H + 60) this.respawn(); // fell off
  }

  private feetY(): number { return this.player.y + PH / 2; }

  private onGround(): boolean {
    const fx = this.player.x;
    const fy = this.feetY();
    return this.platforms.some(
      (p) => fx > p.x - 2 && fx < p.x + p.w + 2 && Math.abs(fy - p.y) < 3,
    );
  }

  private resolveLanding(): boolean {
    if (this.vy < 0) return false;
    const fx = this.player.x;
    const fy = this.feetY();
    for (const p of this.platforms) {
      if (fx > p.x - 2 && fx < p.x + p.w + 2 && fy >= p.y && fy <= p.y + 16) {
        this.player.y = p.y - PH / 2;
        this.vy = 0;
        return true;
      }
    }
    return false;
  }

  private hint(s: string): string {
    switch (s) {
      case "Title": return "SPACE to start";
      case "Win": return "Reached the flag! · SPACE to restart";
      case "Paused": return "P to resume";
      default: return "A/D move · W/↑ jump · P pause · grab coins · reach the flag";
    }
  }
}
