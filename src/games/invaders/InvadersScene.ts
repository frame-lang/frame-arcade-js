import Phaser from "phaser";

/**
 * Public surface of the canonical Invaders machine (mirrors the Godot
 * reference, ch03-invaders). The machine owns the Player + Fleet
 * sub-systems; this scene is a thin driver like Godot main.gd — it ticks
 * the machine, reads m.fleet / m.player for rendering + the march cadence,
 * and reports collisions (player_killed_invader, player_hit,
 * fleet_reached_edge, fleet_reached_bottom).
 */
interface FleetSub {
  is_alive(index: number): boolean;
  get_direction(): number;
  consume_step(): boolean;
  lowest_row(): number;
  cols(): number;
  rows(): number;
}
interface PlayerSub {
  get_state(): string;
}
export interface InvadersMachine {
  start(): void;
  restart(): void;
  pause(): void;
  resume(): void;
  tick(dt: number): void;
  player_killed_invader(index: number): void;
  player_hit(): void;
  fleet_reached_edge(): void;
  fleet_reached_bottom(): void;
  get_current_state_name(): string;
  get_state(): string;
  get_score(): number;
  get_lives(): number;
  get_wave(): number;
  is_paused(): boolean;
  fleet: FleetSub;
  player: PlayerSub;
}

const W = 720;
const H = 480;
const ROWS = 5;
const COLS = 11;
const INV_W = 28;
const INV_H = 20;
const SPACING_X = 46;
const SPACING_Y = 34;
const ORIGIN_X = 40;
const ORIGIN_Y = 60;
const H_STEP = 14;
const V_STEP = 20;
const PLAYER_W = 40;
const PLAYER_H = 16;
const PLAYER_Y = H - 40;
const PLAYER_SPEED = 360;
const BULLET_SPEED = 520;
const ALIEN_BULLET_SPEED = 240;
const ALIEN_FIRE_PER_SEC = 1.1;

export class InvadersScene extends Phaser.Scene {
  private m: InvadersMachine;
  private ship!: Phaser.GameObjects.Rectangle;
  private invaders: Phaser.GameObjects.Rectangle[] = [];
  private pBullets: Phaser.GameObjects.Rectangle[] = [];
  private aBullets: Phaser.GameObjects.Rectangle[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private offX = 0;
  private offY = 0;
  private shotCd = 0;

  constructor(machine: InvadersMachine) {
    super("Invaders");
    this.m = machine;
  }

  create(): void {
    this.ship = this.add.rectangle(W / 2, PLAYER_Y, PLAYER_W, PLAYER_H, 0x8ab4f8);
    const colors = [0xf28b82, 0xfbbc04, 0x81c995, 0x8ab4f8, 0xc58af9];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        this.invaders.push(this.add.rectangle(0, 0, INV_W, INV_H, colors[r % colors.length]));
      }
    }
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "16px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H / 2, "", { ...mono, fontSize: "16px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("A,D,LEFT,RIGHT") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onAction());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onAction(): void {
    const s = this.m.get_state();
    if (s === "attract") { this.m.start(); this.resetField(); }
    else if (s === "game_over") this.m.restart();
    else if (s === "playing") this.fire();
  }

  private onPause(): void {
    if (this.m.is_paused()) this.m.resume();
    else if (this.m.get_state() === "playing" || this.m.get_state() === "player_dying") this.m.pause();
  }

  private resetField(): void {
    this.offX = 0;
    this.offY = 0;
    this.pBullets.forEach((b) => b.destroy());
    this.aBullets.forEach((b) => b.destroy());
    this.pBullets = [];
    this.aBullets = [];
    this.ship.x = W / 2;
  }

  private fire(): void {
    if (this.shotCd > 0 || this.pBullets.length >= 1) return;   // one bullet at a time (canon)
    this.pBullets.push(this.add.rectangle(this.ship.x, PLAYER_Y - PLAYER_H, 4, 12, 0xffffff));
    this.shotCd = 0.4;
  }

  private invaderPos(index: number): { x: number; y: number } {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
      x: ORIGIN_X + col * SPACING_X + this.offX + INV_W / 2,
      y: ORIGIN_Y + row * SPACING_Y + this.offY + INV_H / 2,
    };
  }

  update(_t: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    const s = this.m.get_state();

    if (!this.m.is_paused() && s !== "attract" && s !== "game_over") {
      this.m.tick(dt);
      const st = this.m.get_state();
      if (st === "playing" || st === "player_dying") {
        this.advanceFleetIfReady();
        if (st === "playing") this.movePlayer(dt);
        this.updateBullets(dt);
        this.maybeAlienFire(dt);
        this.checkCollisions();
      }
    }
    this.shotCd = Math.max(0, this.shotCd - dt);

    this.render(s);
    this.scoreText.setText(`score ${this.m.get_score()}   lives ${this.m.get_lives()}   wave ${this.m.get_wave()}`);
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private movePlayer(dt: number): void {
    let dir = 0;
    if (this.keys.A.isDown || this.keys.LEFT.isDown) dir -= 1;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) dir += 1;
    this.ship.x = Phaser.Math.Clamp(this.ship.x + dir * PLAYER_SPEED * dt, PLAYER_W / 2, W - PLAYER_W / 2);
  }

  private updateBullets(dt: number): void {
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      this.pBullets[i].y -= BULLET_SPEED * dt;
      if (this.pBullets[i].y < 0) { this.pBullets[i].destroy(); this.pBullets.splice(i, 1); }
    }
    for (let i = this.aBullets.length - 1; i >= 0; i--) {
      this.aBullets[i].y += ALIEN_BULLET_SPEED * dt;
      if (this.aBullets[i].y > H) { this.aBullets[i].destroy(); this.aBullets.splice(i, 1); }
    }
  }

  private maybeAlienFire(dt: number): void {
    if (this.m.get_state() !== "playing") return;
    if (Math.random() > ALIEN_FIRE_PER_SEC * dt) return;
    const col = Phaser.Math.Between(0, COLS - 1);
    for (let row = ROWS - 1; row >= 0; row--) {
      const idx = row * COLS + col;
      if (this.m.fleet.is_alive(idx)) {
        const p = this.invaderPos(idx);
        this.aBullets.push(this.add.rectangle(p.x, p.y + INV_H, 4, 12, 0xf28b82));
        return;
      }
    }
  }

  private checkCollisions(): void {
    for (let i = this.pBullets.length - 1; i >= 0; i--) {
      const idx = this.findInvaderHit(this.pBullets[i]);
      if (idx >= 0) { this.m.player_killed_invader(idx); this.pBullets[i].destroy(); this.pBullets.splice(i, 1); }
    }
    for (let i = this.aBullets.length - 1; i >= 0; i--) {
      const b = this.aBullets[i];
      if (Math.abs(b.x - this.ship.x) < PLAYER_W / 2 && Math.abs(b.y - PLAYER_Y) < PLAYER_H / 2) {
        this.m.player_hit();
        b.destroy();
        this.aBullets.splice(i, 1);
      }
    }
    if (this.fleetReachedBottom()) this.m.fleet_reached_bottom();
  }

  private findInvaderHit(b: Phaser.GameObjects.Rectangle): number {
    for (let i = 0; i < ROWS * COLS; i++) {
      if (!this.m.fleet.is_alive(i)) continue;
      const p = this.invaderPos(i);
      if (Math.abs(b.x - p.x) < INV_W / 2 && Math.abs(b.y - p.y) < INV_H / 2) return i;
    }
    return -1;
  }

  // Mirror of Godot main.gd _advance_fleet_if_ready: on a due step, move
  // horizontally unless that would push a live invader off-screen, in which
  // case drop down + reverse (the machine's $Stepping flips direction).
  private advanceFleetIfReady(): void {
    if (!this.m.fleet.consume_step()) return;
    const dir = this.m.fleet.get_direction();
    let overshoot = false;
    for (let i = 0; i < ROWS * COLS; i++) {
      if (!this.m.fleet.is_alive(i)) continue;
      const p = this.invaderPos(i);
      const nextLeft = p.x - INV_W / 2 + dir * H_STEP;
      if (nextLeft < 0 || nextLeft + INV_W > W) { overshoot = true; break; }
    }
    if (overshoot) { this.offY += V_STEP; this.m.fleet_reached_edge(); }
    else this.offX += dir * H_STEP;
  }

  private fleetReachedBottom(): boolean {
    const low = this.m.fleet.lowest_row();
    if (low < 0) return false;
    const y = ORIGIN_Y + low * SPACING_Y + INV_H + this.offY;
    return y >= PLAYER_Y;
  }

  private render(s: string): void {
    for (let i = 0; i < this.invaders.length; i++) {
      const alive = (s === "playing" || s === "player_dying" || s === "paused" || s === "wave_complete") && this.m.fleet.is_alive(i);
      this.invaders[i].setVisible(alive);
      if (alive) { const p = this.invaderPos(i); this.invaders[i].setPosition(p.x, p.y); }
    }
    // Ship blinks while the player FSM is exploding/invulnerable.
    const ps = this.m.player.get_state();
    const playable = s === "playing" || s === "player_dying" || s === "wave_complete" || s === "paused";
    this.ship.setVisible(playable && (ps === "alive" || ps === "invulnerable" || (ps === "exploding" && Math.floor(this.time.now / 100) % 2 === 0)));
  }

  private hint(s: string): string {
    switch (s) {
      case "attract": return "SPACE to start";
      case "playing": return "A/D move  ·  SPACE fire  ·  P pause";
      case "player_dying": return "";
      case "wave_complete": return "Wave clear!";
      case "paused": return "P to resume";
      case "game_over": return "Game over  ·  SPACE to restart";
      default: return "";
    }
  }
}
