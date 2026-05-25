import Phaser from "phaser";

export interface GuardMachine {
  start(): void;
  spotted(): void;
  confirmed(): void;
  lost(): void;
  searched(): void;
  returned(): void;
  caught_player(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  alerts(): number;
}

const W = 720;
const H = 480;
const PLAYER_SPEED = 200;
const GUARD_SPEED = 130;
const VISION = 150;
const CATCH = 22;

export class StealthScene extends Phaser.Scene {
  private m: GuardMachine;
  private player!: Phaser.GameObjects.Arc;
  private guard!: Phaser.GameObjects.Arc;
  private visionCircle!: Phaser.GameObjects.Arc;
  private waypoints = [
    { x: 120, y: 120 },
    { x: 600, y: 140 },
    { x: 600, y: 360 },
    { x: 140, y: 360 },
  ];
  private wp = 0;
  private lastSeen = { x: 0, y: 0 };
  private t1 = 0; // suspicion / search timer
  private t2 = 0; // alert-lost timer
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor(machine: GuardMachine) {
    super("Stealth");
    this.m = machine;
  }

  create(): void {
    this.waypoints.forEach((w) => this.add.circle(w.x, w.y, 4, 0x2b3242));
    this.visionCircle = this.add.circle(0, 0, VISION, 0xf28b82, 0.07).setVisible(false);
    this.guard = this.add.circle(this.waypoints[0].x, this.waypoints[0].y, 12, 0xf28b82);
    this.player = this.add.circle(W / 2, H - 60, 10, 0x8ab4f8);

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H - 22, "", { ...mono, fontSize: "14px", color: "#9aa4b8" }).setOrigin(0.5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onSpace(): void {
    const s = this.m.current_state();
    if (s === "Idle") this.m.start();
    else if (s === "Caught") { this.m.restart(); this.player.setPosition(W / 2, H - 60); }
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Patrol") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);
    const s = this.m.current_state();
    const live = s !== "Idle" && s !== "Paused" && s !== "Caught";

    if (live) this.step(dt, s);

    this.guard.setFillStyle(this.guardColor(s));
    this.visionCircle.setPosition(this.guard.x, this.guard.y).setVisible(live);
    this.scoreText.setText(`detections: ${this.m.alerts()}`);
    this.stateText.setText(`guard: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private step(dt: number, s: string): void {
    // player
    const vx = (this.cursors.right.isDown ? 1 : 0) - (this.cursors.left.isDown ? 1 : 0);
    const vy = (this.cursors.down.isDown ? 1 : 0) - (this.cursors.up.isDown ? 1 : 0);
    this.player.x = Phaser.Math.Clamp(this.player.x + vx * PLAYER_SPEED * dt, 10, W - 10);
    this.player.y = Phaser.Math.Clamp(this.player.y + vy * PLAYER_SPEED * dt, 10, H - 10);

    const sees = Phaser.Math.Distance.Between(this.guard.x, this.guard.y, this.player.x, this.player.y) < VISION;
    if (sees) this.lastSeen = { x: this.player.x, y: this.player.y };

    switch (s) {
      case "Patrol": {
        this.patrol(dt);
        if (sees) this.m.spotted();
        break;
      }
      case "Suspicious": {
        this.t1 += dt;
        if (!sees && this.t1 > 0.6) { this.t1 = 0; this.m.lost(); }
        else if (sees && this.t1 > 1.0) { this.t1 = 0; this.m.confirmed(); }
        break;
      }
      case "Alert": {
        this.moveTo(this.player.x, this.player.y, GUARD_SPEED * 1.2, dt);
        if (Phaser.Math.Distance.Between(this.guard.x, this.guard.y, this.player.x, this.player.y) < CATCH) {
          this.m.caught_player();
        } else {
          this.t2 = sees ? 0 : this.t2 + dt;
          if (this.t2 > 1.5) { this.t2 = 0; this.m.lost(); }
        }
        break;
      }
      case "Search": {
        this.moveTo(this.lastSeen.x, this.lastSeen.y, GUARD_SPEED, dt);
        this.t1 += dt;
        if (sees) { this.t1 = 0; this.m.spotted(); }
        else if (this.t1 > 3) { this.t1 = 0; this.m.searched(); }
        break;
      }
      case "Return": {
        const w = this.waypoints[this.wp];
        const arrived = this.moveTo(w.x, w.y, GUARD_SPEED, dt);
        if (sees) this.m.spotted();
        else if (arrived) this.m.returned();
        break;
      }
    }
  }

  private patrol(dt: number): void {
    const w = this.waypoints[this.wp];
    if (this.moveTo(w.x, w.y, GUARD_SPEED, dt)) this.wp = (this.wp + 1) % this.waypoints.length;
  }

  private moveTo(tx: number, ty: number, spd: number, dt: number): boolean {
    const d = Phaser.Math.Distance.Between(this.guard.x, this.guard.y, tx, ty);
    if (d < 6) return true;
    const a = Math.atan2(ty - this.guard.y, tx - this.guard.x);
    this.guard.x += Math.cos(a) * spd * dt;
    this.guard.y += Math.sin(a) * spd * dt;
    return false;
  }

  private guardColor(s: string): number {
    switch (s) {
      case "Patrol": return 0x81c995;
      case "Suspicious": return 0xfbbc04;
      case "Alert": return 0xf28b82;
      case "Search": return 0xff9ce0;
      case "Return": return 0x8ab4f8;
      case "Caught": return 0xff0000;
      default: return 0x5a6172;
    }
  }

  private hint(s: string): string {
    switch (s) {
      case "Idle": return "SPACE to start";
      case "Caught": return "Caught! · SPACE to reset";
      case "Paused": return "P to resume";
      default: return "Arrows move · stay out of the guard's vision · P pause";
    }
  }
}
