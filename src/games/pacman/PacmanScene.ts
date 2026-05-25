import Phaser from "phaser";

export interface PacmanMachine {
  start(): void;
  scatter(): void;
  chase(): void;
  power_pellet(): void;
  pellet_done(): void;
  eaten(): void;
  revived(): void;
  dot_eaten(): void;
  caught(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  dots(): number;
  lives(): number;
}

const W = 720;
const H = 480;
const SPEED = 200;
const GHOST_SPEED = 165;

export class PacmanScene extends Phaser.Scene {
  private m: PacmanMachine;
  private pac!: Phaser.GameObjects.Arc;
  private ghost!: Phaser.GameObjects.Arc;
  private dots: Phaser.GameObjects.Arc[] = [];
  private power!: Phaser.GameObjects.Arc;
  private vx = SPEED;
  private vy = 0;
  private modeTimer = 0;
  private frightTimer = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private prev = "";

  constructor(machine: PacmanMachine) {
    super("Pacman");
    this.m = machine;
  }

  create(): void {
    this.pac = this.add.circle(W / 2, H - 60, 12, 0xfbbc04);
    this.ghost = this.add.circle(W / 2, 80, 12, 0xf28b82);
    this.power = this.add.circle(60, 60, 9, 0xffffff);
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H / 2, "", { ...mono, fontSize: "16px", color: "#9aa4b8" }).setOrigin(0.5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onAction(): void {
    const s = this.m.current_state();
    if (s === "Idle") this.m.start();
    else if (s === "Win" || s === "GameOver") this.m.restart();
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Paused") this.m.resume();
    else if (s !== "Idle" && s !== "Win" && s !== "GameOver") this.m.pause();
  }

  private buildDots(): void {
    this.dots.forEach((d) => d.destroy());
    this.dots = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        this.dots.push(this.add.circle(110 + c * 100, 120 + r * 80, 4, 0xe6e1e8));
      }
    }
    this.power.setPosition(60, 60).setVisible(true);
    this.ghost.setPosition(W / 2, 80);
    this.pac.setPosition(W / 2, H - 60);
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.current_state();
    const playing = !["Idle", "Paused", "Win", "GameOver"].includes(s);

    if (s === "Scatter" && this.prev === "Idle") this.buildDots();
    if ((s === "Win" || s === "GameOver") && this.prev !== s) {
      this.dots.forEach((d) => d.destroy());
      this.dots = [];
    }
    this.prev = s;

    if (playing) this.step(dt, s);

    this.scoreText.setText(`dots ${this.m.dots()}   ghost-lives ${this.m.lives()}`);
    this.stateText.setText(`ghost mode: ${s}`);
    this.hintText.setText(this.hint(s));
    this.ghost.setFillStyle(this.ghostColor(s));
  }

  private step(dt: number, s: string): void {
    // Pac-Man movement (4-way)
    if (this.cursors.left.isDown) { this.vx = -SPEED; this.vy = 0; }
    else if (this.cursors.right.isDown) { this.vx = SPEED; this.vy = 0; }
    else if (this.cursors.up.isDown) { this.vx = 0; this.vy = -SPEED; }
    else if (this.cursors.down.isDown) { this.vx = 0; this.vy = SPEED; }
    this.pac.x = Phaser.Math.Wrap(this.pac.x + this.vx * dt, 0, W);
    this.pac.y = Phaser.Math.Clamp(this.pac.y + this.vy * dt, 12, H - 12);

    // mode alternation Scatter <-> Chase (only while hunting)
    if (s === "Scatter" || s === "Chase") {
      this.modeTimer += dt;
      if (this.modeTimer > 4) {
        this.modeTimer = 0;
        if (s === "Scatter") this.m.chase(); else this.m.scatter();
      }
    }
    // frightened countdown
    if (s === "Frightened") {
      this.frightTimer += dt;
      if (this.frightTimer > 5) { this.frightTimer = 0; this.m.pellet_done(); }
    } else {
      this.frightTimer = 0;
    }

    this.moveGhost(dt, s);
    this.checkCollisions(s);
  }

  private moveGhost(dt: number, s: string): void {
    let tx = this.pac.x, ty = this.pac.y;
    if (s === "Scatter") { tx = 40; ty = 40; }
    else if (s === "Frightened") { tx = W - this.pac.x; ty = H - this.pac.y; }
    else if (s === "Eaten") { tx = W / 2; ty = 80; }
    const a = Math.atan2(ty - this.ghost.y, tx - this.ghost.x);
    const spd = s === "Eaten" ? GHOST_SPEED * 1.8 : GHOST_SPEED;
    this.ghost.x += Math.cos(a) * spd * dt;
    this.ghost.y += Math.sin(a) * spd * dt;
    if (s === "Eaten" && Phaser.Math.Distance.Between(this.ghost.x, this.ghost.y, W / 2, 80) < 12) {
      this.m.revived();
    }
  }

  private checkCollisions(s: string): void {
    for (let i = this.dots.length - 1; i >= 0; i--) {
      if (Phaser.Math.Distance.Between(this.pac.x, this.pac.y, this.dots[i].x, this.dots[i].y) < 14) {
        this.dots[i].destroy();
        this.dots.splice(i, 1);
        this.m.dot_eaten();
      }
    }
    if (this.power.visible && Phaser.Math.Distance.Between(this.pac.x, this.pac.y, this.power.x, this.power.y) < 16) {
      this.power.setVisible(false);
      this.m.power_pellet();
    }
    const touch = Phaser.Math.Distance.Between(this.pac.x, this.pac.y, this.ghost.x, this.ghost.y) < 22;
    if (touch) {
      if (s === "Frightened") this.m.eaten();
      else if (s === "Scatter" || s === "Chase") this.m.caught();
    }
  }

  private ghostColor(s: string): number {
    switch (s) {
      case "Chase": return 0xf28b82;
      case "Scatter": return 0xff9ce0;
      case "Frightened": return 0x4a6cf0;
      case "Eaten": return 0x5a6172;
      default: return 0xf28b82;
    }
  }

  private hint(s: string): string {
    switch (s) {
      case "Idle": return "SPACE to start";
      case "Win": return "All dots eaten! · SPACE to restart";
      case "GameOver": return "Ghost caught you · SPACE to restart";
      case "Paused": return "P to resume";
      default: return "Arrows move · grab the white pellet · P pause";
    }
  }
}
