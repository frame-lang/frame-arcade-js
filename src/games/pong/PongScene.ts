import Phaser from "phaser";

/**
 * The public surface of the Frame-generated Pong machine (the "brain").
 * Mirrors the canonical Godot reference (ch01-pong/frame/pong.fgd): same
 * events and per-state queries.
 */
export interface PongMachine {
  start(): void;
  restart(): void;
  launch(): void;
  pause(): void;
  resume(): void;
  ball_out_left(): void;
  ball_out_right(): void;
  get_current_state_name(): string;
  get_score_left(): number;
  get_score_right(): number;
  get_serve_direction(): number;
  get_winner(): string;
  get_winning_score(): number;
  is_playing(): boolean;
}

export const GAME_W = 720;
export const GAME_H = 480;
const PADDLE_W = 12;
const PADDLE_H = 84;
const BALL = 12;
const PADDLE_SPEED = 400;
const BALL_SPEED = 340;

/**
 * Phaser is the "body": rendering, input, and per-frame physics. It never
 * decides game *flow* — it reads `get_state()` to know what to do and fires
 * interface events (`launch`, `ball_out_left`, …) into the Frame machine when
 * play demands a flow change. The machine owns every state transition.
 */
export class PongScene extends Phaser.Scene {
  private m: PongMachine;
  private left!: Phaser.GameObjects.Rectangle;
  private right!: Phaser.GameObjects.Rectangle;
  private ball!: Phaser.GameObjects.Rectangle;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private bvx = 0;
  private bvy = 0;
  private prev = "";

  constructor(machine: PongMachine) {
    super("Pong");
    this.m = machine;
  }

  create(): void {
    for (let y = 10; y < GAME_H; y += 28) {
      this.add.rectangle(GAME_W / 2, y, 3, 14, 0x2b3242);
    }
    this.left = this.add.rectangle(28, GAME_H / 2, PADDLE_W, PADDLE_H, 0x8ab4f8);
    this.right = this.add.rectangle(GAME_W - 28, GAME_H / 2, PADDLE_W, PADDLE_H, 0xf28b82);
    this.ball = this.add.rectangle(GAME_W / 2, GAME_H / 2, BALL, BALL, 0xffffff);

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(GAME_W / 2, 22, "0 : 0", { ...mono, fontSize: "30px" }).setOrigin(0.5);
    this.stateText = this.add.text(GAME_W / 2, 52, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(0.5);
    this.hintText = this.add.text(GAME_W / 2, GAME_H - 26, "", { ...mono, fontSize: "15px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("W,S,UP,DOWN") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => this.onPause());

    // Initial ball position: park it next to whichever paddle will serve
    // first. update() will keep it pinned to that paddle while in
    // Serving — but during Attract the ball still sits there visibly.
    this.parkBall();
  }

  private onAction(): void {
    switch (this.m.get_current_state_name()) {
      case "AttractMode": this.m.start(); break;
      case "Serving": this.m.launch(); this.launch(); break;
      case "GameOver": this.m.restart(); break;
    }
  }

  private onPause(): void {
    const s = this.m.get_current_state_name();
    if (s === "Serving" || s === "InPlay") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  // Park the ball next to whichever paddle is about to serve, so it
  // visually sits on the paddle and tracks its Y while the player lines
  // up before pressing SPACE. Serve direction +1 means the ball will
  // travel right (left paddle serves); -1 means it'll travel left
  // (right paddle serves).
  private parkBall(): void {
    const dir = this.m.get_serve_direction() >= 0 ? 1 : -1;
    if (dir === 1) {
      this.ball.x = this.left.x + (PADDLE_W + BALL) / 2;
      this.ball.y = this.left.y;
    } else {
      this.ball.x = this.right.x - (PADDLE_W + BALL) / 2;
      this.ball.y = this.right.y;
    }
    this.bvx = 0;
    this.bvy = 0;
  }

  // Set the initial velocity at the moment of serve. The ball is
  // already parked next to the serving paddle; this just gives it a
  // direction and a slight vertical spread.
  private launch(): void {
    const dir = this.m.get_serve_direction() >= 0 ? 1 : -1;
    const angle = Phaser.Math.FloatBetween(-0.35, 0.35);
    this.bvx = Math.cos(angle) * BALL_SPEED * dir;
    this.bvy = Math.sin(angle) * BALL_SPEED;
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.get_current_state_name();

    // Paddle input runs whenever the rally is active OR the player is
    // about to serve, so they can line up before pressing SPACE.
    if (s === "Serving" || s === "InPlay") this.movePaddles(dt);

    // While serving, keep the ball pinned to the serving paddle so its
    // Y matches what the player sees.
    if (s === "Serving") this.parkBall();

    if (s === "InPlay") this.stepBall(dt);

    this.scoreText.setText(`${this.m.get_score_left()} : ${this.m.get_score_right()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
    this.prev = s;
  }

  private movePaddles(dt: number): void {
    if (this.keys.W.isDown || this.keys.UP.isDown) this.left.y -= PADDLE_SPEED * dt;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) this.left.y += PADDLE_SPEED * dt;
    this.clamp(this.left);

    // Right paddle: simple tracking AI. While serving, the ball is
    // pinned to the serving paddle's Y, so the AI naturally stays
    // still (or follows itself harmlessly if it's the server).
    const dy = this.ball.y - this.right.y;
    this.right.y += Phaser.Math.Clamp(dy, -PADDLE_SPEED * dt, PADDLE_SPEED * dt);
    this.clamp(this.right);
  }

  private stepBall(dt: number): void {
    this.ball.x += this.bvx * dt;
    this.ball.y += this.bvy * dt;
    if (this.ball.y < BALL / 2) { this.ball.y = BALL / 2; this.bvy = Math.abs(this.bvy); }
    if (this.ball.y > GAME_H - BALL / 2) { this.ball.y = GAME_H - BALL / 2; this.bvy = -Math.abs(this.bvy); }

    this.bounce(this.left, 1);
    this.bounce(this.right, -1);

    // Ball off the left edge => right player scored (ball_out_left);
    // off the right edge => left player scored (ball_out_right).
    if (this.ball.x < -BALL) this.m.ball_out_left();
    else if (this.ball.x > GAME_W + BALL) this.m.ball_out_right();
  }

  private bounce(paddle: Phaser.GameObjects.Rectangle, dir: number): void {
    const overlap =
      Math.abs(this.ball.x - paddle.x) < (PADDLE_W + BALL) / 2 &&
      Math.abs(this.ball.y - paddle.y) < (PADDLE_H + BALL) / 2;
    if (overlap && Math.sign(this.bvx) === -dir) {
      this.bvx = Math.abs(this.bvx) * dir;
      const off = (this.ball.y - paddle.y) / (PADDLE_H / 2);
      this.bvy = off * BALL_SPEED * 0.8;
    }
  }

  private clamp(p: Phaser.GameObjects.Rectangle): void {
    p.y = Phaser.Math.Clamp(p.y, PADDLE_H / 2, GAME_H - PADDLE_H / 2);
  }

  private hint(s: string): string {
    switch (s) {
      case "AttractMode": return `SPACE to start  ·  first to ${this.m.get_winning_score()}`;
      case "Serving": return "SPACE to serve  ·  W/S move  ·  P pause";
      case "InPlay": return "W/S move  ·  P pause";
      case "Paused": return "P to resume";
      case "GameOver":
        return `${this.m.get_winner().toUpperCase()} wins!  ·  SPACE to play again`;
      default: return "";
    }
  }
}
