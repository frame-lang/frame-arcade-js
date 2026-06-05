import Phaser from "phaser";

/**
 * Public surface of the canonical Platformer machine (mirrors the
 * Godot reference, ch06-platformer). The machine owns only the
 * character's MIND — the Locomotion mode (idle/walk/run/jump/
 * fall/land) and the PowerUp form (small/big/fiery), plus the
 * orchestrator's push$/pop$ pause. This scene is a thin driver like
 * Godot main.gd: it owns the WORLD — platforms, gravity, AABB
 * collision, pickups, and the body's position. It reads the FSM's
 * velocity *wishes* each frame and reports physics facts
 * (ground_contact / left_ground / pickup_*) back.
 */
export interface PlatformerMachine {
  tick(dt: number): void;
  press_left(): void;
  press_right(): void;
  release_horizontal(): void;
  press_sprint(): void;
  release_sprint(): void;
  press_jump(): void;
  release_jump(): void;
  ground_contact(): void;
  left_ground(): void;
  pickup_mushroom(): void;
  pickup_flower(): void;
  take_damage(): boolean;
  pause(): void;
  resume(): void;
  is_paused(): boolean;
  get_current_state_name(): string;
  locomotion_state(): string;
  form(): string;
  wants_velocity_x(): number;
  wants_jump_impulse(): boolean;
  consume_jump_impulse(): void;
  facing(): number;
  is_grounded(): boolean;
  is_in_air(): boolean;
  hit_box_height(): number;
  can_shoot(): boolean;
}

const W = 720;
const H = 480;
const PLAYER_W = 24;
const JUMP_IMPULSE = 540;
const JUMP_CUT = 0.4;
const GRAVITY = 900;
const TERMINAL = 600;

interface Rect { x: number; y: number; w: number; h: number; }
interface Pickup { x: number; y: number; w: number; h: number; alive: boolean; }

const SPAWN = { x: 60, y: 400 };

export class PlatformerScene extends Phaser.Scene {
  private m: PlatformerMachine;
  private px = SPAWN.x;
  private py = SPAWN.y;
  private vx = 0;
  private vy = 0;
  private wasGrounded = true;

  private platforms: Rect[] = [];
  private mushroom!: Pickup;
  private flower!: Pickup;

  // Edge-detected input flags (mirror the Godot driver).
  private leftDown = false;
  private rightDown = false;
  private sprintDown = false;
  private jumpDown = false;
  private pauseDown = false;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private platformGfx!: Phaser.GameObjects.Graphics;
  private gfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;

  constructor(machine: PlatformerMachine) {
    super("Platformer");
    this.m = machine;
  }

  create(): void {
    this.platforms = [
      { x: 0, y: 448, w: W, h: 32 }, // floor
      { x: 100, y: 340, w: 130, h: 18 },
      { x: 300, y: 260, w: 130, h: 18 },
      { x: 500, y: 340, w: 130, h: 18 },
      { x: 40, y: 180, w: 90, h: 18 }, // high ledge
    ];
    this.mushroom = { x: 360, y: 232, w: 18, h: 18, alive: true };
    this.flower = { x: 60, y: 156, w: 18, h: 20, alive: true };

    this.platformGfx = this.add.graphics();
    this.drawPlatforms();
    this.gfx = this.add.graphics();

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.hudText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.add.text(12, H - 22, "Arrows/WASD move · Shift run · Space jump · P pause · R reset pickups", {
      ...mono,
      fontSize: "13px",
      color: "#9aa4b8",
    });
    this.centerText = this.add
      .text(W / 2, H * 0.4, "", { ...mono, fontSize: "20px", align: "center", color: "#e6e1e8" })
      .setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,UP,A,D,W,SHIFT,SPACE,P,R") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
  }

  private respawn(): void {
    this.px = SPAWN.x;
    this.py = SPAWN.y;
    this.vx = 0;
    this.vy = 0;
    this.wasGrounded = true;
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);

    // Pause toggle (P), edge-detected. Mirrors the Godot driver: the
    // FSM owns the pause mode; we just freeze the world while paused.
    const pNow = this.keys.P.isDown;
    if (pNow && !this.pauseDown) {
      if (this.m.is_paused()) this.m.resume();
      else this.m.pause();
    }
    this.pauseDown = pNow;

    if (!this.m.is_paused()) {
      this.handleInput();
      this.m.tick(dt);
      this.applyJumpImpulse();
      this.vx = this.m.wants_velocity_x();
      this.applyGravity(dt);
      this.integrateAndCollide(dt);
      this.updateGrounded();
      this.checkPickups();
      if (this.keys.R.isDown) {
        this.mushroom.alive = true;
        this.flower.alive = true;
      }
    }

    this.render();
  }

  private handleInput(): void {
    const leftNow = this.keys.LEFT.isDown || this.keys.A.isDown;
    const rightNow = this.keys.RIGHT.isDown || this.keys.D.isDown;
    const sprintNow = this.keys.SHIFT.isDown;
    const jumpNow = this.keys.SPACE.isDown || this.keys.UP.isDown || this.keys.W.isDown;

    if (leftNow && !this.leftDown) this.m.press_left();
    if (rightNow && !this.rightDown) this.m.press_right();
    if (!leftNow && !rightNow && (this.leftDown || this.rightDown)) this.m.release_horizontal();
    this.leftDown = leftNow;
    this.rightDown = rightNow;

    if (sprintNow && !this.sprintDown) this.m.press_sprint();
    if (!sprintNow && this.sprintDown) this.m.release_sprint();
    this.sprintDown = sprintNow;

    if (jumpNow && !this.jumpDown) this.m.press_jump();
    if (!jumpNow && this.jumpDown) {
      this.m.release_jump();
      // Variable jump height: releasing while ascending cuts the rise.
      if (this.vy < 0) this.vy *= JUMP_CUT;
    }
    this.jumpDown = jumpNow;
  }

  private applyJumpImpulse(): void {
    if (this.m.wants_jump_impulse()) {
      this.vy = -JUMP_IMPULSE;
      this.m.consume_jump_impulse();
    }
  }

  private applyGravity(dt: number): void {
    this.vy += GRAVITY * dt;
    if (this.vy > TERMINAL) this.vy = TERMINAL;
  }

  private integrateAndCollide(dt: number): void {
    const h = this.m.hit_box_height();
    this.px += this.vx * dt;
    this.resolveX(h);
    this.py += this.vy * dt;
    this.resolveY(h);

    if (this.px < 0) {
      this.px = 0;
      this.vx = 0;
    }
    if (this.px + PLAYER_W > W) {
      this.px = W - PLAYER_W;
      this.vx = 0;
    }
    if (this.py > H) this.respawn();
  }

  private resolveX(h: number): void {
    for (const p of this.platforms) {
      if (this.intersects(this.px, this.py, PLAYER_W, h, p)) {
        if (this.vx > 0) this.px = p.x - PLAYER_W;
        else if (this.vx < 0) this.px = p.x + p.w;
        this.vx = 0;
      }
    }
  }

  private resolveY(h: number): void {
    for (const p of this.platforms) {
      if (this.intersects(this.px, this.py, PLAYER_W, h, p)) {
        if (this.vy > 0) this.py = p.y - h;
        else if (this.vy < 0) this.py = p.y + p.h;
        this.vy = 0;
      }
    }
  }

  private updateGrounded(): void {
    const h = this.m.hit_box_height();
    let grounded = false;
    for (const p of this.platforms) {
      if (this.intersects(this.px, this.py + 1, PLAYER_W, h, p)) {
        grounded = true;
        break;
      }
    }
    if (grounded && !this.wasGrounded) this.m.ground_contact();
    else if (!grounded && this.wasGrounded) this.m.left_ground();
    this.wasGrounded = grounded;
  }

  private checkPickups(): void {
    const h = this.m.hit_box_height();
    if (this.mushroom.alive && this.intersects(this.px, this.py, PLAYER_W, h, this.mushroom)) {
      this.m.pickup_mushroom();
      this.mushroom.alive = false;
    }
    if (this.flower.alive && this.intersects(this.px, this.py, PLAYER_W, h, this.flower)) {
      this.m.pickup_flower();
      this.flower.alive = false;
    }
  }

  private intersects(ax: number, ay: number, aw: number, ah: number, b: Rect): boolean {
    return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y;
  }

  private drawPlatforms(): void {
    this.platformGfx.clear();
    for (const p of this.platforms) {
      this.platformGfx.fillStyle(0x735926, 1);
      this.platformGfx.fillRect(p.x, p.y, p.w, p.h);
      this.platformGfx.fillStyle(0xa6824d, 1);
      this.platformGfx.fillRect(p.x, p.y, p.w, 3);
    }
  }

  private render(): void {
    this.gfx.clear();

    if (this.mushroom.alive) this.drawMushroom(this.mushroom.x, this.mushroom.y);
    if (this.flower.alive) this.drawFlower(this.flower.x, this.flower.y);

    this.drawPlayer();

    const paused = this.m.is_paused();
    this.hudText.setText(
      `STATE  ${this.m.locomotion_state()}     FORM  ${this.m.form()}     GROUNDED  ${this.m.is_grounded() ? "yes" : "no"}`,
    );
    this.centerText.setText(paused ? "PAUSED\n\nP to resume" : "");
  }

  private drawPlayer(): void {
    const h = this.m.hit_box_height();
    const form = this.m.form();
    let color = 0xe53232; // small
    if (form === "big") color = 0x4caf50;
    else if (form === "fiery") color = 0xff8c1a;

    this.gfx.fillStyle(color, 1);
    this.gfx.fillRect(this.px, this.py, PLAYER_W, h);

    // Eye on the facing side.
    const eyeX = this.m.facing() > 0 ? this.px + PLAYER_W - 8 : this.px + 2;
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillRect(eyeX, this.py + 4, 6, 6);
    this.gfx.fillStyle(0x000000, 1);
    this.gfx.fillRect(eyeX + 1, this.py + 5, 4, 4);

    // Landing squish tell.
    if (this.m.locomotion_state() === "landing") {
      this.gfx.fillStyle(0x000000, 0.25);
      this.gfx.fillRect(this.px - 2, this.py + h - 4, PLAYER_W + 4, 4);
    }
  }

  private drawMushroom(x: number, y: number): void {
    this.gfx.fillStyle(0xe5d9bf, 1);
    this.gfx.fillRect(x, y + 8, 18, 10);
    this.gfx.fillStyle(0xd94040, 1);
    this.gfx.fillRect(x, y, 18, 10);
    this.gfx.fillStyle(0xffffff, 1);
    this.gfx.fillRect(x + 3, y + 2, 3, 3);
    this.gfx.fillRect(x + 11, y + 4, 3, 3);
  }

  private drawFlower(x: number, y: number): void {
    this.gfx.fillStyle(0x33b34d, 1);
    this.gfx.fillRect(x + 7, y + 12, 4, 8);
    this.gfx.fillStyle(0xff661a, 1);
    this.gfx.fillRect(x + 2, y + 2, 14, 10);
    this.gfx.fillStyle(0xffd933, 1);
    this.gfx.fillRect(x + 6, y + 6, 6, 6);
  }
}
