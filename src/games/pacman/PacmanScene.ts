import Phaser from "phaser";
import { Ghost } from "./pacman.machine.js";

/**
 * Public surface of the canonical GhostGame machine (mirrors the Godot
 * reference, ch05-pacman). Like the Godot version this is a GHOST-AI DEMO:
 * the machine owns the four ghost FSMs + global scatter/chase/frightened
 * coordination; the scene owns Pac-Man movement, pellets, and ghost
 * steering, exactly like Godot main.gd. There is no win/lose/pause in the
 * machine — pause is a scene-level freeze.
 */
export interface GhostGameMachine {
  start(): void;
  add_ghost(g: unknown): void;
  tick(dt: number): void;
  power_pellet_picked_up(): void;
  ghost_caught(index: number): void;
  ghost_arrived_at_pen(index: number): void;
  get_current_state_name(): string;
  get_phase(): string;
  is_frightened(): boolean;
  ghost_count(): number;
  ghost_state(index: number): string;
  ghost_is_dangerous(index: number): boolean;
  ghost_is_edible(index: number): boolean;
  ghost_home_corner(index: number): { x: number; y: number };
  ghost_target_kind(index: number): number;
  get_score(): number;
  frighten_seconds_left(): number;
}

const W = 720;
const H = 480;
const PAC_SPEED = 150;
const GHOST_NORMAL = 120;
const GHOST_FRIGHT = 80;
const GHOST_EATEN = 240;
const PAC_R = 12;
const GHOST_R = 12;
const PELLET_R = 4;
const INSET = 40;
const PEN = { x: W / 2, y: H / 2 };
const GHOST_COLORS = [0xf28b82, 0xf9a8d4, 0x67e8f9, 0xfbbf24];

interface Pellet { obj: Phaser.GameObjects.Arc; x: number; y: number; alive: boolean; power: boolean; }

export class PacmanScene extends Phaser.Scene {
  private m: GhostGameMachine;
  private pac!: Phaser.GameObjects.Arc;
  private px = W / 2;
  private py = H - 60;
  private dx = 0;
  private dy = 0;
  private ghostObjs: Phaser.GameObjects.Arc[] = [];
  private gx: number[] = [];
  private gy: number[] = [];
  private pellets: Pellet[] = [];
  private started = false;
  private paused = false;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;

  constructor(machine: GhostGameMachine) {
    super("Pacman");
    this.m = machine;
  }

  create(): void {
    this.pac = this.add.circle(this.px, this.py, PAC_R, 0xfde047);
    const corners = [
      { x: W - INSET, y: INSET },        // blinky
      { x: INSET, y: INSET },            // pinky
      { x: W - INSET, y: H - INSET },    // inky
      { x: INSET, y: H - INSET },        // clyde
    ];
    const names = ["blinky", "pinky", "inky", "clyde"];
    for (let i = 0; i < 4; i++) {
      this.ghostObjs.push(this.add.circle(PEN.x, PEN.y, GHOST_R, GHOST_COLORS[i]).setVisible(false));
      this.gx.push(PEN.x);
      this.gy.push(PEN.y);
      // index 0 = blinky (referenced by inky's targeting); kinds 0..3
      this.m.add_ghost(Ghost._create(names[i], corners[i], i));
    }

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H - 22, "", { ...mono, fontSize: "14px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => { if (this.started) this.paused = !this.paused; });
    this.input.keyboard!.on("keydown-R", () => this.buildPellets());

    this.buildPellets();
  }

  private onAction(): void {
    if (!this.started) { this.m.start(); this.started = true; }
  }

  private buildPellets(): void {
    this.pellets.forEach((p) => p.obj.destroy());
    this.pellets = [];
    const cols = 9;
    const rows = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = INSET + (c * (W - 2 * INSET)) / (cols - 1);
        const y = INSET + (r * (H - 2 * INSET)) / (rows - 1);
        const power = (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1);
        const obj = this.add.circle(x, y, power ? PELLET_R * 2 : PELLET_R, power ? 0xffffff : 0x9aa4b8);
        this.pellets.push({ obj, x, y, alive: true, power });
      }
    }
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;

    if (this.started && !this.paused) {
      this.m.tick(dt);
      this.movePac(dt);
      this.moveGhosts(dt);
      this.checkPellets();
      this.checkGhostCollisions();
    }

    this.pac.setPosition(this.px, this.py);
    this.renderGhosts();
    this.scoreText.setText(`score ${this.m.get_score()}   phase ${this.m.get_phase()}   fright ${this.m.frighten_seconds_left().toFixed(1)}s`);
    this.stateText.setText(`state: ${this.m.get_phase()}`);
    this.hintText.setText(!this.started ? "SPACE to start" : (this.paused ? "P to resume" : "WASD/arrows move · power pellets frighten ghosts · P pause · R refill"));
  }

  private movePac(dt: number): void {
    let ix = 0;
    let iy = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) ix -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) ix += 1;
    if (this.keys.W.isDown || this.keys.UP.isDown) iy -= 1;
    if (this.keys.S.isDown || this.keys.DOWN.isDown) iy += 1;
    const len = Math.hypot(ix, iy);
    if (len > 0.01) {
      this.dx = ix / len;
      this.dy = iy / len;
      this.px += this.dx * PAC_SPEED * dt;
      this.py += this.dy * PAC_SPEED * dt;
    }
    this.px = Phaser.Math.Clamp(this.px, PAC_R, W - PAC_R);
    this.py = Phaser.Math.Clamp(this.py, PAC_R, H - PAC_R);
  }

  private moveGhosts(dt: number): void {
    const n = this.m.ghost_count();
    for (let i = 0; i < n; i++) {
      const st = this.m.ghost_state(i);
      let speed = GHOST_NORMAL;
      let tx = this.gx[i];
      let ty = this.gy[i];
      if (st === "in_pen") { tx = PEN.x; ty = PEN.y; speed = 0; }
      else if (st === "chase") { const t = this.chaseTarget(i); tx = t.x; ty = t.y; }
      else if (st === "scatter") { const h = this.m.ghost_home_corner(i); tx = h.x; ty = h.y; }
      else if (st === "frightened") { const t = this.fleeTarget(); tx = t.x; ty = t.y; speed = GHOST_FRIGHT; }
      else if (st === "eaten") { tx = PEN.x; ty = PEN.y; speed = GHOST_EATEN; }

      if (speed > 0) {
        const ddx = tx - this.gx[i];
        const ddy = ty - this.gy[i];
        const d = Math.hypot(ddx, ddy);
        if (d > 1) { this.gx[i] += (ddx / d) * speed * dt; this.gy[i] += (ddy / d) * speed * dt; }
      }
      if (st === "eaten" && Math.hypot(this.gx[i] - PEN.x, this.gy[i] - PEN.y) < GHOST_R) {
        this.m.ghost_arrived_at_pen(i);
      }
    }
  }

  private chaseTarget(i: number): { x: number; y: number } {
    const kind = this.m.ghost_target_kind(i);
    if (kind === 1) return { x: this.px + this.dx * 80, y: this.py + this.dy * 80 };
    if (kind === 2) {
      const ax = this.px + this.dx * 40;
      const ay = this.py + this.dy * 40;
      return { x: ax + (ax - this.gx[0]), y: ay + (ay - this.gy[0]) };
    }
    if (kind === 3) {
      if (Math.hypot(this.gx[i] - this.px, this.gy[i] - this.py) > 160) return { x: this.px, y: this.py };
      return this.m.ghost_home_corner(i);
    }
    return { x: this.px, y: this.py };
  }

  private fleeTarget(): { x: number; y: number } {
    const corners = [
      { x: INSET, y: INSET }, { x: W - INSET, y: INSET },
      { x: INSET, y: H - INSET }, { x: W - INSET, y: H - INSET },
    ];
    let best = corners[0];
    let bestD = 0;
    for (const c of corners) {
      const d = Math.hypot(c.x - this.px, c.y - this.py);
      if (d > bestD) { bestD = d; best = c; }
    }
    return best;
  }

  private checkPellets(): void {
    for (const p of this.pellets) {
      if (!p.alive) continue;
      if (Math.hypot(this.px - p.x, this.py - p.y) < PAC_R + (p.power ? PELLET_R * 2 : PELLET_R)) {
        p.alive = false;
        p.obj.setVisible(false);
        if (p.power) this.m.power_pellet_picked_up();
      }
    }
  }

  private checkGhostCollisions(): void {
    const n = this.m.ghost_count();
    for (let i = 0; i < n; i++) {
      const st = this.m.ghost_state(i);
      if (st === "eaten" || st === "in_pen") continue;
      if (Math.hypot(this.px - this.gx[i], this.py - this.gy[i]) < PAC_R + GHOST_R) {
        // Eat the ghost if edible; a dangerous ghost is ignored here (demo),
        // exactly like the Godot reference.
        if (this.m.ghost_is_edible(i)) this.m.ghost_caught(i);
      }
    }
  }

  private renderGhosts(): void {
    const n = this.m.ghost_count();
    for (let i = 0; i < this.ghostObjs.length; i++) {
      const show = this.started && i < n;
      this.ghostObjs[i].setVisible(show);
      if (!show) continue;
      this.ghostObjs[i].setPosition(this.gx[i], this.gy[i]);
      const st = this.m.ghost_state(i);
      let color = GHOST_COLORS[i];
      if (st === "frightened") color = 0x3b82f6;
      else if (st === "eaten") color = 0x475569;
      this.ghostObjs[i].setFillStyle(color);
    }
  }
}
