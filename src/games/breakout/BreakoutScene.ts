import Phaser from "phaser";

export interface BreakoutMachine {
  start(): void;
  serve(): void;
  brick_hit(): void;
  ball_lost(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  score(): number;
  lives(): number;
  bricks(): number;
}

const W = 720;
const H = 480;
const PADDLE_W = 96;
const PADDLE_H = 12;
const BALL = 10;
const PADDLE_SPEED = 460;
const BALL_SPEED = 320;
const COLS = 10;
const ROWS = 4;

export class BreakoutScene extends Phaser.Scene {
  private m: BreakoutMachine;
  private paddle!: Phaser.GameObjects.Rectangle;
  private ball!: Phaser.GameObjects.Rectangle;
  private bricks: Phaser.GameObjects.Rectangle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bvx = 0;
  private bvy = 0;
  private prev = "";

  constructor(machine: BreakoutMachine) {
    super("Breakout");
    this.m = machine;
  }

  create(): void {
    this.paddle = this.add.rectangle(W / 2, H - 24, PADDLE_W, PADDLE_H, 0x8ab4f8);
    this.ball = this.add.rectangle(W / 2, H - 40, BALL, BALL, 0xffffff);
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "16px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H / 2, "", { ...mono, fontSize: "16px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("A,D,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
    this.resetBall();
  }

  private onAction(): void {
    switch (this.m.current_state()) {
      case "Title": this.m.start(); break;
      case "Serve": this.m.serve(); this.launch(); break;
      case "Cleared": this.m.serve(); break;
      case "GameOver": this.m.restart(); break;
    }
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Serve" || s === "Playing" || s === "Cleared") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  private resetBall(): void {
    this.ball.setPosition(this.paddle.x, H - 40);
    this.bvx = 0;
    this.bvy = 0;
  }
  private launch(): void {
    this.bvx = Phaser.Math.FloatBetween(-1, 1) * BALL_SPEED * 0.6;
    this.bvy = -BALL_SPEED;
  }

  private buildBricks(n: number): void {
    this.bricks.forEach((b) => b.destroy());
    this.bricks = [];
    const pad = 6;
    const bw = (W - pad * (COLS + 1)) / COLS;
    const bh = 18;
    const colors = [0xf28b82, 0xfbbc04, 0x81c995, 0x8ab4f8];
    let made = 0;
    for (let r = 0; r < ROWS && made < n; r++) {
      for (let c = 0; c < COLS && made < n; c++) {
        const x = pad + c * (bw + pad) + bw / 2;
        const y = 60 + r * (bh + pad) + bh / 2;
        this.bricks.push(this.add.rectangle(x, y, bw, bh, colors[r % colors.length]));
        made++;
      }
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.current_state();

    if (s === "Playing" && this.prev !== "Playing" && this.bricks.length < this.m.bricks()) {
      this.buildBricks(this.m.bricks());
    }
    if ((s === "Serve" || s === "Title") && this.prev !== s) this.resetBall();
    this.prev = s;

    if (s === "Serve") this.ball.x = this.paddle.x; // ball rides the paddle pre-serve
    if (s === "Serve" || s === "Playing") this.movePaddle(dt);
    if (s === "Playing") this.stepBall(dt);

    this.scoreText.setText(`score ${this.m.score()}   lives ${this.m.lives()}   bricks ${this.m.bricks()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private movePaddle(dt: number): void {
    if (this.keys.A.isDown || this.keys.LEFT.isDown) this.paddle.x -= PADDLE_SPEED * dt;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) this.paddle.x += PADDLE_SPEED * dt;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, PADDLE_W / 2, W - PADDLE_W / 2);
  }

  private stepBall(dt: number): void {
    this.ball.x += this.bvx * dt;
    this.ball.y += this.bvy * dt;

    if (this.ball.x < BALL / 2) { this.ball.x = BALL / 2; this.bvx = Math.abs(this.bvx); }
    if (this.ball.x > W - BALL / 2) { this.ball.x = W - BALL / 2; this.bvx = -Math.abs(this.bvx); }
    if (this.ball.y < BALL / 2) { this.ball.y = BALL / 2; this.bvy = Math.abs(this.bvy); }

    // paddle
    if (this.hit(this.paddle) && this.bvy > 0) {
      this.bvy = -Math.abs(this.bvy);
      this.bvx += ((this.ball.x - this.paddle.x) / (PADDLE_W / 2)) * 120;
    }

    // bricks
    for (let i = this.bricks.length - 1; i >= 0; i--) {
      if (this.hit(this.bricks[i])) {
        const b = this.bricks[i];
        this.bvy = this.ball.y < b.y ? -Math.abs(this.bvy) : Math.abs(this.bvy);
        b.destroy();
        this.bricks.splice(i, 1);
        this.m.brick_hit();
        break;
      }
    }

    if (this.ball.y > H + BALL) this.m.ball_lost();
  }

  private hit(o: Phaser.GameObjects.Rectangle): boolean {
    return (
      Math.abs(this.ball.x - o.x) < (o.width + BALL) / 2 &&
      Math.abs(this.ball.y - o.y) < (o.height + BALL) / 2
    );
  }

  private hint(s: string): string {
    switch (s) {
      case "Title": return "SPACE to start";
      case "Serve": return "SPACE to launch  ·  A/D move";
      case "Playing": return "";
      case "Cleared": return "Level cleared!  ·  SPACE for next";
      case "Paused": return "P to resume";
      case "GameOver": return "Game over  ·  SPACE to restart";
      default: return "";
    }
  }
}
