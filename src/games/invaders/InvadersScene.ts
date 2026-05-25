import Phaser from "phaser";

export interface InvadersMachine {
  start(): void;
  dive(): void;
  land(): void;
  invader_killed(): void;
  reached_bottom(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  score(): number;
  lives(): number;
  invaders(): number;
}

const W = 720;
const H = 480;
const COLS = 6;
const ROWS = 4;
const SHIP_SPEED = 380;
const BULLET_SPEED = 460;

export class InvadersScene extends Phaser.Scene {
  private m: InvadersMachine;
  private ship!: Phaser.GameObjects.Rectangle;
  private bullet!: Phaser.GameObjects.Rectangle;
  private invaders: Phaser.GameObjects.Rectangle[] = [];
  private dir = 1;
  private diveTimer = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private prev = "";

  constructor(machine: InvadersMachine) {
    super("Invaders");
    this.m = machine;
  }

  create(): void {
    this.ship = this.add.rectangle(W / 2, H - 24, 40, 14, 0x81c995);
    this.bullet = this.add.rectangle(-10, -10, 4, 12, 0xffffff).setVisible(false);
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "16px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H / 2, "", { ...mono, fontSize: "16px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("A,D,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onAction(): void {
    const s = this.m.current_state();
    if (s === "Title") this.m.start();
    else if (s === "Victory" || s === "GameOver") this.m.restart();
    else if ((s === "Marching" || s === "Diving") && !this.bullet.visible) this.fire();
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Marching" || s === "Diving") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  private fire(): void {
    this.bullet.setPosition(this.ship.x, this.ship.y - 16).setVisible(true);
  }

  private buildFormation(): void {
    this.invaders.forEach((i) => i.destroy());
    this.invaders = [];
    const gx = 80, gy = 60, dx = (W - 160) / (COLS - 1), dy = 42;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.invaders.push(this.add.rectangle(gx + c * dx, gy + r * dy, 30, 20, 0xf28b82));
      }
    }
    this.dir = 1;
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.current_state();
    const playing = s === "Marching" || s === "Diving";

    if (playing && this.invaders.length === 0) this.buildFormation();
    if (s === "Title" && this.prev !== "Title") { this.invaders.forEach((i) => i.destroy()); this.invaders = []; }
    this.prev = s;

    if (playing) this.stepPlay(dt, s === "Diving");

    this.scoreText.setText(`score ${this.m.score()}   ships ${this.m.lives()}   left ${this.m.invaders()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private stepPlay(dt: number, diving: boolean): void {
    if (this.keys.A.isDown || this.keys.LEFT.isDown) this.ship.x -= SHIP_SPEED * dt;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) this.ship.x += SHIP_SPEED * dt;
    this.ship.x = Phaser.Math.Clamp(this.ship.x, 20, W - 20);

    // formation marches; in Diving it also creeps downward faster
    const speed = (diving ? 70 : 40);
    let edge = false;
    for (const inv of this.invaders) {
      inv.x += this.dir * speed * dt;
      if (inv.x < 20 || inv.x > W - 20) edge = true;
      if (diving) inv.y += 26 * dt;
    }
    if (edge) {
      this.dir *= -1;
      this.invaders.forEach((i) => (i.y += 16));
    }

    // periodic dive/land to exercise the HSM children
    this.diveTimer += dt;
    if (!diving && this.diveTimer > 3) { this.diveTimer = 0; this.m.dive(); }
    if (diving && this.diveTimer > 1.2) { this.diveTimer = 0; this.m.land(); }

    // bullet
    if (this.bullet.visible) {
      this.bullet.y -= BULLET_SPEED * dt;
      if (this.bullet.y < 0) this.bullet.setVisible(false);
      for (let i = this.invaders.length - 1; i >= 0; i--) {
        const inv = this.invaders[i];
        if (Math.abs(this.bullet.x - inv.x) < 18 && Math.abs(this.bullet.y - inv.y) < 14) {
          inv.destroy();
          this.invaders.splice(i, 1);
          this.bullet.setVisible(false);
          this.m.invader_killed();
          break;
        }
      }
    }

    // reached the player's row?
    if (this.invaders.some((i) => i.y > H - 60)) {
      this.m.reached_bottom();
      this.invaders.forEach((i) => (i.y -= 200));
    }
  }

  private hint(s: string): string {
    switch (s) {
      case "Title": return "SPACE to start";
      case "Marching":
      case "Diving": return "A/D move · SPACE fire · P pause";
      case "Paused": return "P to resume";
      case "Victory": return "Cleared the wave! · SPACE to restart";
      case "GameOver": return "Game over · SPACE to restart";
      default: return "";
    }
  }
}
