import Phaser from "phaser";

/**
 * Public surface of the canonical Stealth machine (mirrors the
 * Godot reference, ch08-stealth). The machine owns each guard's
 * MIND — its mode, timers, last-known memory, patrol cursor, and
 * the target it wants to walk toward (three @@Guard() instances
 * exposed as guard1/guard2/guard3). This scene is a thin driver
 * like Godot main.gd: it owns the world GEOMETRY — the maze, the
 * actual guard/player positions, vision-cone math, line-of-sight,
 * and collision. It perceives ("can guard i see the player?") and
 * reports facts back via spot_player; the Frame side reacts.
 */
interface Vec {
  x: number;
  y: number;
}
interface GuardSub {
  get_state(): string;
  get_target(): Vec;
  get_last_known(): Vec;
  is_aware(): boolean;
  is_alerted(): boolean;
  should_move(): boolean;
  spot_player(at: Vec): void;
}
export interface StealthMachine {
  start(p1: Vec[], p2: Vec[], p3: Vec[]): void;
  restart(): void;
  pause(): void;
  resume(): void;
  tick(dt: number, pos1: Vec, pos2: Vec, pos3: Vec): void;
  guard_caught_player(i: number): void;
  player_at_exit(): void;
  get_current_state_name(): string;
  get_state(): string;
  get_elapsed(): number;
  get_caught_by(): number;
  guard1: GuardSub;
  guard2: GuardSub;
  guard3: GuardSub;
}

// 16x12 tiles @ 40px = 640x480 maze, centred in the 720x480 court.
const TILE = 40;
const COLS = 16;
const ROWS = 12;
const W = 720;
const H = 480;
const OX = (W - COLS * TILE) / 2; // left margin so the maze is centred
const MAZE = [
  "################",
  "#..............#",
  "#..S...........#",
  "#..............#",
  "####.######.####",
  "#..............#",
  "#.######..######",
  "#..............#",
  "######.######..#",
  "#..............#",
  "#.............E#",
  "################",
];

const PLAYER_SPEED = 115;
const GUARD_SPEED = 78; // matches Stealth.PATROL_SPEED scaled for the 40px grid
const PLAYER_R = 8;
const GUARD_R = 9;
const CATCH_R = 15;
const VISION_RANGE = 145;
const VISION_HALF = Phaser.Math.DegToRad(28);

const C_FLOOR = 0x12141c;
const C_WALL = 0x2e3346;
const C_PLAYER = 0xffe833;
const C_GUARD_NORMAL = 0xb3c0d9;
const C_GUARD_AWARE = 0xf2d873;
const C_GUARD_ALERT = 0xf07272;

export class StealthScene extends Phaser.Scene {
  private m: StealthMachine;
  private walls: boolean[][] = [];
  private startPos: Vec = { x: 0, y: 0 };
  private exitPos: Vec = { x: 0, y: 0 };

  private px = 0;
  private py = 0;
  private pFacing = -Math.PI / 2;
  private gx = [0, 0, 0];
  private gy = [0, 0, 0];
  private gf = [0, Math.PI, 0];

  private coneGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private guardObjs: Phaser.GameObjects.Arc[] = [];
  private playerObj!: Phaser.GameObjects.Arc;
  private exitObj!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private hudText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;

  constructor(machine: StealthMachine) {
    super("Stealth");
    this.m = machine;
  }

  create(): void {
    this.parseMaze();

    this.add.rectangle(OX + (COLS * TILE) / 2, (ROWS * TILE) / 2, COLS * TILE, ROWS * TILE, C_FLOOR);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (this.walls[r][c]) {
          this.add.rectangle(OX + c * TILE + TILE / 2, r * TILE + TILE / 2, TILE, TILE, C_WALL);
        }
      }
    }

    this.exitObj = this.add.rectangle(OX + this.exitPos.x, this.exitPos.y, TILE * 0.9, TILE * 0.9, 0x33f080);
    this.coneGfx = this.add.graphics();
    this.guardObjs = [0, 1, 2].map(() => this.add.circle(0, 0, GUARD_R, C_GUARD_NORMAL));
    this.playerObj = this.add.circle(0, 0, PLAYER_R, C_PLAYER);
    this.fxGfx = this.add.graphics();

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.hudText = this.add.text(12, 10, "", { ...mono, fontSize: "14px" });
    this.stateText = this.add
      .text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" })
      .setOrigin(1, 0);
    this.centerText = this.add
      .text(W / 2, H * 0.42, "", { ...mono, fontSize: "18px", align: "center", color: "#e6e1e8" })
      .setOrigin(0.5);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys("W,A,S,D") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
    this.input.keyboard!.on("keydown-R", () => this.onRestart());

    this.resetPositions();
  }

  private parseMaze(): void {
    this.walls = [];
    for (let r = 0; r < ROWS; r++) {
      const row: boolean[] = [];
      for (let c = 0; c < COLS; c++) {
        const ch = MAZE[r][c];
        row.push(ch === "#");
        if (ch === "S") this.startPos = this.cellCenter(c, r);
        else if (ch === "E") this.exitPos = this.cellCenter(c, r);
      }
      this.walls.push(row);
    }
  }

  private cellCenter(col: number, row: number): Vec {
    return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
  }

  // Patrol routes, one per guard — mirrors Godot _patrol_for. Each
  // loop stays inside one open "room" so straight-line walking with
  // slide-against-wall collision never wedges a guard.
  private patrolFor(i: number): Vec[] {
    if (i === 0) return [this.cellCenter(2, 1), this.cellCenter(13, 1), this.cellCenter(7, 3)];
    if (i === 1) return [this.cellCenter(3, 5), this.cellCenter(8, 5), this.cellCenter(12, 5)];
    return [this.cellCenter(2, 9), this.cellCenter(13, 9), this.cellCenter(13, 10), this.cellCenter(2, 10)];
  }

  private resetPositions(): void {
    this.px = this.startPos.x;
    this.py = this.startPos.y;
    this.pFacing = -Math.PI / 2;
    const starts = [this.cellCenter(5, 2), this.cellCenter(8, 5), this.cellCenter(8, 10)];
    for (let i = 0; i < 3; i++) {
      this.gx[i] = starts[i].x;
      this.gy[i] = starts[i].y;
    }
    this.gf = [0, Math.PI, 0];
  }

  private onSpace(): void {
    if (this.m.get_state() === "attract") {
      this.resetPositions();
      this.m.start(this.patrolFor(0), this.patrolFor(1), this.patrolFor(2));
    }
  }

  private onPause(): void {
    const s = this.m.get_state();
    if (s === "playing") this.m.pause();
    else if (s === "paused") this.m.resume();
  }

  private onRestart(): void {
    const s = this.m.get_state();
    if (s === "caught" || s === "escaped") {
      this.m.restart();
      this.resetPositions();
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);
    const s = this.m.get_state();
    if (s === "playing") this.stepPlaying(dt);
    this.render(s);
  }

  private guards(): GuardSub[] {
    return [this.m.guard1, this.m.guard2, this.m.guard3];
  }

  private stepPlaying(dt: number): void {
    this.movePlayer(dt);

    const gs = this.guards();
    for (let i = 0; i < 3; i++) {
      const g = gs[i];
      if (g.should_move()) {
        const t = g.get_target();
        const np = this.stepWithCollision(this.gx[i], this.gy[i], t.x, t.y, GUARD_SPEED, dt, GUARD_R);
        this.gx[i] = np.x;
        this.gy[i] = np.y;
      }
      const look = this.facingTarget(g);
      this.gf[i] = this.smoothFace(this.gf[i], this.gx[i], this.gy[i], look.x, look.y, dt);
    }

    // Frame side decides modes from the post-collision positions.
    this.m.tick(
      dt,
      { x: this.gx[0], y: this.gy[0] },
      { x: this.gx[1], y: this.gy[1] },
      { x: this.gx[2], y: this.gy[2] },
    );

    // Perception: report a sighting per guard whose cone + LOS hits
    // the player. Silence is the "lost sight" signal.
    for (let i = 0; i < 3; i++) {
      if (this.canSee(i, this.gf[i])) gs[i].spot_player({ x: this.px, y: this.py });
    }

    // Catch + escape detection.
    for (let i = 0; i < 3; i++) {
      if (Math.hypot(this.gx[i] - this.px, this.gy[i] - this.py) < CATCH_R) {
        this.m.guard_caught_player(i);
        break;
      }
    }
    if (Math.hypot(this.px - this.exitPos.x, this.py - this.exitPos.y) < TILE * 0.45) {
      this.m.player_at_exit();
    }
  }

  private facingTarget(g: GuardSub): Vec {
    const st = g.get_state();
    if (st === "patrolling" || st === "idle") return g.get_target();
    return g.get_last_known();
  }

  private movePlayer(dt: number): void {
    let dx = 0;
    let dy = 0;
    if (this.cursors.left.isDown || this.wasd.A.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.D.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.W.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.S.isDown) dy += 1;
    if (dx === 0 && dy === 0) return;
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    this.pFacing = Math.atan2(dy, dx);
    const stepX = dx * PLAYER_SPEED * dt;
    const stepY = dy * PLAYER_SPEED * dt;
    if (!this.circleBlocked(this.px + stepX, this.py, PLAYER_R)) this.px += stepX;
    if (!this.circleBlocked(this.px, this.py + stepY, PLAYER_R)) this.py += stepY;
  }

  // Step toward (tx,ty) at speed, sliding axis-by-axis against walls.
  private stepWithCollision(fx: number, fy: number, tx: number, ty: number, speed: number, dt: number, radius: number): Vec {
    const ddx = tx - fx;
    const ddy = ty - fy;
    const dist = Math.hypot(ddx, ddy);
    if (dist < 0.5) return { x: fx, y: fy };
    const stepSize = Math.min(speed * dt, dist);
    const sx = (ddx / dist) * stepSize;
    const sy = (ddy / dist) * stepSize;
    let x = fx;
    let y = fy;
    if (!this.circleBlocked(x + sx, y, radius)) x += sx;
    if (!this.circleBlocked(x, y + sy, radius)) y += sy;
    return { x, y };
  }

  private circleBlocked(x: number, y: number, radius: number): boolean {
    const samples = [
      { x: x + radius, y },
      { x: x - radius, y },
      { x, y: y + radius },
      { x, y: y - radius },
    ];
    for (const s of samples) {
      const c = Math.floor(s.x / TILE);
      const r = Math.floor(s.y / TILE);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return true;
      if (this.walls[r][c]) return true;
    }
    return false;
  }

  private canSee(i: number, facing: number): boolean {
    const dx = this.px - this.gx[i];
    const dy = this.py - this.gy[i];
    const d = Math.hypot(dx, dy);
    if (d > VISION_RANGE || d < 0.5) return d < 0.5;
    const diff = Phaser.Math.Angle.Wrap(Math.atan2(dy, dx) - facing);
    if (Math.abs(diff) > VISION_HALF) return false;
    return this.losClear(this.gx[i], this.gy[i], this.px, this.py);
  }

  private losClear(fx: number, fy: number, tx: number, ty: number): boolean {
    const dx = tx - fx;
    const dy = ty - fy;
    const d = Math.hypot(dx, dy);
    if (d === 0) return true;
    const n = Math.ceil(d / 6);
    const sx = dx / n;
    const sy = dy / n;
    let x = fx;
    let y = fy;
    for (let k = 0; k < n; k++) {
      x += sx;
      y += sy;
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false;
      if (this.walls[r][c]) return false;
    }
    return true;
  }

  // Walk a ray from a guard until LOS breaks or max range — used to
  // clip the drawn vision cone against walls.
  private rayHit(gx: number, gy: number, ang: number): Vec {
    const dx = Math.cos(ang);
    const dy = Math.sin(ang);
    let x = gx;
    let y = gy;
    let dist = 0;
    while (dist < VISION_RANGE) {
      x += dx * 6;
      y += dy * 6;
      dist += 6;
      const c = Math.floor(x / TILE);
      const r = Math.floor(y / TILE);
      if (c < 0 || c >= COLS || r < 0 || r >= ROWS) break;
      if (this.walls[r][c]) break;
    }
    return { x, y };
  }

  private smoothFace(current: number, fx: number, fy: number, tx: number, ty: number, dt: number): number {
    if (Math.hypot(tx - fx, ty - fy) < 1) return current;
    return Phaser.Math.Angle.RotateTo(current, Math.atan2(ty - fy, tx - fx), 4 * dt);
  }

  private render(s: string): void {
    const showWorld = s !== "attract";

    // Vision cones (clipped against walls), tinted by guard mood.
    this.coneGfx.clear();
    if (showWorld) {
      const gs = this.guards();
      for (let i = 0; i < 3; i++) {
        const g = gs[i];
        let color = 0xd9e6ff;
        let alpha = 0.1;
        if (g.is_alerted()) {
          color = C_GUARD_ALERT;
          alpha = 0.18;
        } else if (g.is_aware()) {
          color = C_GUARD_AWARE;
          alpha = 0.16;
        }
        const pts: Vec[] = [{ x: OX + this.gx[i], y: this.gy[i] }];
        const steps = 18;
        for (let k = 0; k <= steps; k++) {
          const t = -VISION_HALF + 2 * VISION_HALF * (k / steps);
          const hit = this.rayHit(this.gx[i], this.gy[i], this.gf[i] + t);
          pts.push({ x: OX + hit.x, y: hit.y });
        }
        this.coneGfx.fillStyle(color, alpha);
        this.coneGfx.fillPoints(pts as Phaser.Geom.Point[], true);
      }
    }

    // Exit pulse.
    this.exitObj.setAlpha(showWorld ? 0.7 + 0.3 * Math.sin(this.time.now / 220) : 0.0);

    // Guards.
    const gs = this.guards();
    this.fxGfx.clear();
    for (let i = 0; i < 3; i++) {
      const g = gs[i];
      const obj = this.guardObjs[i];
      obj.setVisible(showWorld);
      if (!showWorld) continue;
      obj.setPosition(OX + this.gx[i], this.gy[i]);
      let col = C_GUARD_NORMAL;
      if (g.is_alerted()) col = C_GUARD_ALERT;
      else if (g.is_aware()) col = C_GUARD_AWARE;
      obj.setFillStyle(col);
      // Facing notch.
      this.fxGfx.lineStyle(2, 0xffffff, 0.8);
      this.fxGfx.lineBetween(
        OX + this.gx[i],
        this.gy[i],
        OX + this.gx[i] + Math.cos(this.gf[i]) * (GUARD_R + 4),
        this.gy[i] + Math.sin(this.gf[i]) * (GUARD_R + 4),
      );
    }

    // Player (hidden on caught so the cone "flash" reads cleanly).
    const showPlayer = showWorld && s !== "caught";
    this.playerObj.setVisible(showPlayer);
    if (showPlayer) {
      this.playerObj.setPosition(OX + this.px, this.py);
      this.fxGfx.lineStyle(2, 0xffffff, 1);
      this.fxGfx.lineBetween(
        OX + this.px,
        this.py,
        OX + this.px + Math.cos(this.pFacing) * (PLAYER_R + 4),
        this.py + Math.sin(this.pFacing) * (PLAYER_R + 4),
      );
    }

    this.hudText.setText(`TIME ${this.m.get_elapsed().toFixed(1)}s   ·   reach the green exit unseen   ·   P pause`);
    this.stateText.setText(`state: ${s}`);
    this.centerText.setText(this.centerMsg(s));
  }

  private centerMsg(s: string): string {
    switch (s) {
      case "attract":
        return "S T E A L T H\n\nReach the green exit without entering a vision cone\n\nArrows / WASD move    ·    SPACE start";
      case "paused":
        return "PAUSED\n\nP to resume";
      case "caught":
        return `CAUGHT BY GUARD ${this.m.get_caught_by() + 1}\n\n${this.m.get_elapsed().toFixed(1)}s survived    ·    R to restart`;
      case "escaped":
        return `ESCAPED IN ${this.m.get_elapsed().toFixed(1)}s\n\nR for another run`;
      default:
        return "";
    }
  }
}
