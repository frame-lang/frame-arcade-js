import Phaser from "phaser";

/**
 * The public surface of the canonical Breakout machine (mirrors the Godot
 * reference, ch02-breakout). The machine owns ball velocity (the Ball
 * sub-system) and the brick field (the BrickField sub-system); this scene is
 * a thin driver — it reads ball_vx/ball_vy each frame, integrates position,
 * and reports collisions back (wall_bounce_x/y, paddle_hit, brick_hit,
 * ball_fell_off), exactly like the Godot main.gd.
 */
export interface BreakoutMachine {
  start(): void;
  launch_ball(vx: number, vy: number): void;
  brick_hit(index: number): void;
  paddle_hit(vx: number, vy: number): void;
  wall_bounce_x(): void;
  wall_bounce_y(): void;
  ball_fell_off(): void;
  tick(dt: number): void;
  pause(): void;
  resume(): void;
  restart(): void;
  get_current_state_name(): string;
  get_state(): string;
  get_score(): number;
  get_lives(): number;
  get_level(): number;
  bricks_remaining(): number;
  is_brick_broken(index: number): boolean;
  ball_state(): string;
  ball_vx(): number;
  ball_vy(): number;
  ball_respawn_progress(): number;
}

const W = 720;
const H = 480;
const PADDLE_W = 96;
const PADDLE_H = 12;
const BALL = 10;
const PADDLE_SPEED = 460;
const BALL_SPEED = 320;
const COLS = 10;
const ROWS = 4;        // COLS * ROWS = 40 = the machine's brick_count
const PAD = 6;
const BRICK_H = 18;
const BRICK_TOP = 60;

export class BreakoutScene extends Phaser.Scene {
  private m: BreakoutMachine;
  private paddle!: Phaser.GameObjects.Rectangle;
  private ball!: Phaser.GameObjects.Rectangle;
  private bricks: Phaser.GameObjects.Rectangle[] = [];   // index-aligned with the machine's brick list
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
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
    this.buildBricks();
    this.parkBall();
  }

  private onAction(): void {
    switch (this.m.get_state()) {
      case "attract": this.m.start(); break;
      // In $Playing the ball starts attached; SPACE launches it.
      case "playing": if (this.m.ball_state() === "attached") this.m.launch_ball(this.launchVx(), -BALL_SPEED); break;
      case "level_clear": this.m.start(); break;   // start() advances to the next level
      case "game_over": this.m.restart(); break;
    }
  }

  private onPause(): void {
    const s = this.m.get_state();
    if (s === "playing") this.m.pause();
    else if (s === "paused") this.m.resume();
  }

  private launchVx(): number {
    return Phaser.Math.FloatBetween(-1, 1) * BALL_SPEED * 0.6;
  }

  // Build the full COLS×ROWS grid; visibility is driven each frame by the
  // machine's is_brick_broken(i).
  private buildBricks(): void {
    this.bricks.forEach((b) => b.destroy());
    this.bricks = [];
    const bw = (W - PAD * (COLS + 1)) / COLS;
    const colors = [0xf28b82, 0xfbbc04, 0x81c995, 0x8ab4f8];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = PAD + c * (bw + PAD) + bw / 2;
        const y = BRICK_TOP + r * (BRICK_H + PAD) + BRICK_H / 2;
        this.bricks.push(this.add.rectangle(x, y, bw, BRICK_H, colors[r % colors.length]));
      }
    }
  }

  private parkBall(): void {
    this.ball.setPosition(this.paddle.x, H - 40);
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.get_state();

    // On entering any new state that isn't paused, park the ball on the
    // paddle and reset alpha to fully visible. Otherwise the ball can sit
    // off-screen (its last in-flight position when it fell) through
    // GameOver / Attract. Exception: resume (paused → playing) must
    // preserve the in-flight position so play continues where it left off.
    const transitioned = this.prev !== s;
    const cameFromPaused = this.prev === "paused";
    this.prev = s;
    if (transitioned && s !== "paused" && !cameFromPaused) {
      this.parkBall();
      this.ball.setAlpha(1);
    }

    if (s === "playing") {
      this.m.tick(dt);
      this.movePaddle(dt);
      // Ball alpha tracks the Ball's $Lost.$.elapsed (1.0 in attached/in_flight,
      // 0 → 1 during the 2-second respawn pause).
      this.ball.setAlpha(this.m.ball_respawn_progress());
      const bs = this.m.ball_state();
      if (bs === "in_flight") this.stepBall(dt);
      else this.parkBall(); // attached *or* lost — the ball rides the paddle
    }

    // Brick visibility reflects the machine's brick field.
    for (let i = 0; i < this.bricks.length; i++) {
      this.bricks[i].setVisible(!this.m.is_brick_broken(i));
    }

    this.scoreText.setText(
      `score ${this.m.get_score()}   lives ${this.m.get_lives()}   level ${this.m.get_level()}   bricks ${this.m.bricks_remaining()}`,
    );
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private movePaddle(dt: number): void {
    if (this.keys.A.isDown || this.keys.LEFT.isDown) this.paddle.x -= PADDLE_SPEED * dt;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) this.paddle.x += PADDLE_SPEED * dt;
    this.paddle.x = Phaser.Math.Clamp(this.paddle.x, PADDLE_W / 2, W - PADDLE_W / 2);
  }

  // The machine owns velocity: read it, integrate, report collisions back
  // (which mutate the machine's velocity), then let the next frame re-read.
  private stepBall(dt: number): void {
    this.ball.x += this.m.ball_vx() * dt;
    this.ball.y += this.m.ball_vy() * dt;

    if (this.ball.x < BALL / 2) { this.ball.x = BALL / 2; if (this.m.ball_vx() < 0) this.m.wall_bounce_x(); }
    if (this.ball.x > W - BALL / 2) { this.ball.x = W - BALL / 2; if (this.m.ball_vx() > 0) this.m.wall_bounce_x(); }
    if (this.ball.y < BALL / 2) { this.ball.y = BALL / 2; if (this.m.ball_vy() < 0) this.m.wall_bounce_y(); }

    // Paddle: reflect upward with english based on contact offset.
    if (this.hit(this.paddle) && this.m.ball_vy() > 0) {
      const vx = this.m.ball_vx() + ((this.ball.x - this.paddle.x) / (PADDLE_W / 2)) * 120;
      this.m.paddle_hit(vx, -Math.abs(this.m.ball_vy()));
    }

    // Bricks: report the first hit; the machine breaks it + bounces + scores.
    for (let i = 0; i < this.bricks.length; i++) {
      if (!this.m.is_brick_broken(i) && this.hit(this.bricks[i])) {
        this.m.brick_hit(i);
        break;
      }
    }

    if (this.ball.y > H + BALL) this.m.ball_fell_off();
  }

  private hit(o: Phaser.GameObjects.Rectangle): boolean {
    return (
      Math.abs(this.ball.x - o.x) < (o.width + BALL) / 2 &&
      Math.abs(this.ball.y - o.y) < (o.height + BALL) / 2
    );
  }

  private hint(s: string): string {
    switch (s) {
      case "attract": return "SPACE to start";
      case "playing": return this.m.ball_state() === "attached" ? "SPACE to launch  ·  A/D move  ·  P pause" : "A/D move  ·  P pause";
      case "level_clear": return "Level cleared!  ·  SPACE for next";
      case "paused": return "P to resume";
      case "game_over": return "Game over  ·  SPACE to restart";
      default: return "";
    }
  }
}
