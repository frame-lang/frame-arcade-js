import Phaser from "phaser";
import { Enemy } from "./shooter.machine.js";

/**
 * Public surface of the canonical Shooter machine (mirrors the Godot
 * reference, ch07-shooter). The machine owns every entity's MODE —
 * the player's alive/hit/invuln states, each Enemy's spawn/active/
 * dying lifecycle, the Boss's three-phase HSM + attack patterns, and
 * the wave/boss scheduling. This scene is a thin driver like Godot
 * main.gd: it owns positions, bullet physics, collision, and
 * rendering, reading the FSM's fire and spawn signals and reporting
 * hits back. Side-scroller: player on the left fires right; enemies
 * and the boss come from the right.
 */
interface PlayerSub {
  is_visible(): boolean;
  can_fire(): boolean;
  can_be_hit(): boolean;
  get_state(): string;
  get_lives(): number;
}
interface BossSub {
  is_alive(): boolean;
  is_dying(): boolean;
  is_gone(): boolean;
  get_phase(): number;
  get_hp_fraction(): number;
  wants_to_fire_single(): boolean;
  wants_to_fire_spread(): boolean;
  wants_to_fire_spray(): boolean;
  consume_fire(): void;
}
interface EnemySub {
  hit(damage: number): void;
  get_state(): string;
  get_kind(): number;
  wants_to_fire(): boolean;
  consume_fire(): void;
  is_alive(): boolean;
  is_cleanup(): boolean;
}
export interface ShooterMachine {
  start(): void;
  restart(): void;
  tick(dt: number): void;
  add_enemy(e: unknown): void;
  clear_dead_enemies(): void;
  player_hit(): void;
  enemy_hit(index: number, damage: number): boolean;
  boss_hit(damage: number): boolean;
  pause(): void;
  resume(): void;
  get_current_state_name(): string;
  get_state(): string;
  get_score(): number;
  get_lives(): number;
  enemy_count(): number;
  should_spawn_wave(): boolean;
  consume_wave(): void;
  should_spawn_boss(): boolean;
  consume_boss_spawn(): void;
  player: PlayerSub;
  boss: BossSub;
}

const W = 720;
const H = 480;
const PLAYER = { w: 28, h: 14 };
const PLAYER_SPEED = 260;
const SHOT_COOLDOWN = 0.18;
const PLAYER_BULLET_SPEED = 600;
const ENEMY = { w: 24, h: 18 };
const ENEMY_BULLET_SPEED = 260;
const BOSS = { w: 80, h: 80 };
const BOSS_BULLET_SPEED = 280;

interface EnemyRec { e: EnemySub; x: number; y: number; vx: number; spawnT: number; }
interface Bullet { x: number; y: number; }
interface MovingBullet { x: number; y: number; vx: number; vy: number; }

export class ShooterScene extends Phaser.Scene {
  private m: ShooterMachine;
  private px = 80;
  private py = H / 2;
  private shotTimer = 0;
  private enemies: EnemyRec[] = [];
  private playerBullets: Bullet[] = [];
  private enemyBullets: MovingBullet[] = [];
  private bossX = W - 120;
  private bossY = H / 2;
  private bossVy = 60;
  private bossVisible = false;
  private pauseDown = false;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private gfx!: Phaser.GameObjects.Graphics;
  private starGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private centerText!: Phaser.GameObjects.Text;

  constructor(machine: ShooterMachine) {
    super("Shooter");
    this.m = machine;
  }

  create(): void {
    this.starGfx = this.add.graphics();
    this.drawStarfield();
    this.gfx = this.add.graphics();

    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.hudText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.centerText = this.add
      .text(W / 2, H * 0.4, "", { ...mono, fontSize: "20px", align: "center", color: "#e6e1e8" })
      .setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,P,R") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-R", () => this.onR());
  }

  private onSpace(): void {
    if (this.m.get_state() === "attract") {
      this.m.start();
      this.resetRun();
    }
  }
  private onR(): void {
    const s = this.m.get_state();
    if (s === "game_over" || s === "victory") this.m.restart();
  }

  private resetRun(): void {
    this.px = 80;
    this.py = H / 2;
    this.shotTimer = 0;
    this.enemies = [];
    this.playerBullets = [];
    this.enemyBullets = [];
    this.bossVisible = false;
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);

    // Pause toggle (P), edge-detected on the pre-input state.
    const stateBefore = this.m.get_state();
    const pNow = this.keys.P.isDown;
    if (pNow && !this.pauseDown) {
      if (stateBefore === "paused") this.m.resume();
      else if (stateBefore === "playing" || stateBefore === "boss_fight") this.m.pause();
    }
    this.pauseDown = pNow;

    const s = this.m.get_state();
    if (s === "playing" || s === "boss_fight") {
      this.m.tick(dt);
      this.updatePlayer(dt);
      this.maybeSpawnWave();
      this.updateEnemies(dt);
      this.updateBoss(dt);
      this.updateBullets(dt);
      this.checkCollisions();
      this.m.clear_dead_enemies();
      this.enemies = this.enemies.filter((r) => !r.e.is_cleanup());
    }

    this.render(s);
  }

  private updatePlayer(dt: number): void {
    this.shotTimer = Math.max(0, this.shotTimer - dt);
    if (!this.m.player.is_visible()) return;

    let dx = 0;
    let dy = 0;
    if (this.keys.LEFT.isDown || this.keys.A.isDown) dx -= 1;
    if (this.keys.RIGHT.isDown || this.keys.D.isDown) dx += 1;
    if (this.keys.UP.isDown || this.keys.W.isDown) dy -= 1;
    if (this.keys.DOWN.isDown || this.keys.S.isDown) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len > 0.01) {
      dx /= len;
      dy /= len;
    }
    this.px = Phaser.Math.Clamp(this.px + dx * PLAYER_SPEED * dt, 0, W - PLAYER.w);
    this.py = Phaser.Math.Clamp(this.py + dy * PLAYER_SPEED * dt, 0, H - PLAYER.h);

    if (this.m.player.can_fire() && this.keys.SPACE.isDown && this.shotTimer <= 0) {
      this.playerBullets.push({ x: this.px + PLAYER.w, y: this.py + PLAYER.h / 2 });
      this.shotTimer = SHOT_COOLDOWN;
    }
  }

  private maybeSpawnWave(): void {
    if (!this.m.should_spawn_wave()) return;
    const kind = Phaser.Math.Between(0, 2);
    for (let i = 0; i < 3; i++) {
      this.spawnEnemy(kind, W + 30 + i * 40, 60 + Math.random() * (H - 120));
    }
    this.m.consume_wave();
  }

  private spawnEnemy(kind: number, x: number, y: number): void {
    let hp = 1;
    let rate = 0;
    let points = 50;
    if (kind === 0) { hp = 1; rate = 1.5; points = 50; }
    else if (kind === 1) { hp = 1; rate = 2.0; points = 80; }
    else { hp = 2; rate = 2.5; points = 150; }
    const e = Enemy._create(kind, hp, rate, points) as EnemySub;
    this.m.add_enemy(e);
    this.enemies.push({ e, x, y, vx: -140, spawnT: this.time.now / 1000 });
  }

  private updateEnemies(dt: number): void {
    for (const r of this.enemies) {
      if (!r.e.is_alive()) continue;
      const t = this.time.now / 1000 - r.spawnT;
      const kind = r.e.get_kind();
      r.x += r.vx * dt;
      if (kind === 1) r.y += Math.sin(t * 3) * 60 * dt;
      else if (kind === 2) r.y += Math.sin(t * 1.5) * 120 * dt;
      if (r.x < -60) r.e.hit(9999); // off-screen left → force death/cleanup

      if (r.e.is_alive() && r.e.wants_to_fire()) {
        this.enemyBullets.push({ x: r.x, y: r.y + ENEMY.h / 2, vx: -ENEMY_BULLET_SPEED, vy: 0 });
        r.e.consume_fire();
      }
    }
  }

  private updateBoss(dt: number): void {
    if (!this.m.should_spawn_boss() && !this.bossVisible) return;
    if (this.m.should_spawn_boss()) {
      this.bossVisible = true;
      this.bossX = W - 120;
      this.bossY = H / 2;
      this.m.consume_boss_spawn();
    }
    if (!this.bossVisible) return;
    if (this.m.boss.is_gone()) {
      this.bossVisible = false;
      return;
    }

    this.bossY += this.bossVy * dt;
    if (this.bossY < 80) { this.bossY = 80; this.bossVy = Math.abs(this.bossVy); }
    else if (this.bossY + BOSS.h > H - 20) { this.bossY = H - 20 - BOSS.h; this.bossVy = -Math.abs(this.bossVy); }

    const mx = this.bossX;
    const my = this.bossY + BOSS.h / 2;
    if (this.m.boss.wants_to_fire_single()) {
      this.enemyBullets.push({ x: mx, y: my, vx: -BOSS_BULLET_SPEED, vy: 0 });
      this.m.boss.consume_fire();
    } else if (this.m.boss.wants_to_fire_spread()) {
      for (const a of [-0.3, 0, 0.3]) {
        this.enemyBullets.push({ x: mx, y: my, vx: -BOSS_BULLET_SPEED * Math.cos(a), vy: BOSS_BULLET_SPEED * Math.sin(a) });
      }
      this.m.boss.consume_fire();
    } else if (this.m.boss.wants_to_fire_spray()) {
      const a = Phaser.Math.FloatBetween(-0.6, 0.6);
      this.enemyBullets.push({ x: mx, y: my, vx: -BOSS_BULLET_SPEED * 1.1 * Math.cos(a), vy: BOSS_BULLET_SPEED * 1.1 * Math.sin(a) });
      this.m.boss.consume_fire();
    }
  }

  private updateBullets(dt: number): void {
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      this.playerBullets[i].x += PLAYER_BULLET_SPEED * dt;
      if (this.playerBullets[i].x > W + 20) this.playerBullets.splice(i, 1);
    }
    for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
      const b = this.enemyBullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20) this.enemyBullets.splice(i, 1);
    }
  }

  private checkCollisions(): void {
    // player bullets vs enemies (route hits through the FSM by index)
    for (let i = this.playerBullets.length - 1; i >= 0; i--) {
      const b = this.playerBullets[i];
      let hit = -1;
      for (let j = 0; j < this.enemies.length; j++) {
        const r = this.enemies[j];
        if (r.e.is_alive() && this.pointInRect(b.x, b.y, r.x, r.y, ENEMY.w, ENEMY.h)) {
          hit = j;
          break;
        }
      }
      if (hit >= 0) {
        this.m.enemy_hit(hit, 1);
        this.playerBullets.splice(i, 1);
      }
    }

    // player bullets vs boss
    if (this.bossVisible && this.m.boss.is_alive()) {
      for (let i = this.playerBullets.length - 1; i >= 0; i--) {
        const b = this.playerBullets[i];
        if (this.pointInRect(b.x, b.y, this.bossX, this.bossY, BOSS.w, BOSS.h)) {
          this.m.boss_hit(1);
          this.playerBullets.splice(i, 1);
        }
      }
    }

    // enemy bullets vs player
    if (this.m.player.can_be_hit()) {
      for (let i = this.enemyBullets.length - 1; i >= 0; i--) {
        const b = this.enemyBullets[i];
        if (this.pointInRect(b.x, b.y, this.px, this.py, PLAYER.w, PLAYER.h)) {
          this.m.player_hit();
          this.enemyBullets.splice(i, 1);
          break;
        }
      }
    }

    // enemies vs player
    if (this.m.player.can_be_hit()) {
      for (let j = 0; j < this.enemies.length; j++) {
        const r = this.enemies[j];
        if (r.e.is_alive() && this.rectsOverlap(this.px, this.py, PLAYER.w, PLAYER.h, r.x, r.y, ENEMY.w, ENEMY.h)) {
          this.m.player_hit();
          this.m.enemy_hit(j, 9999);
          break;
        }
      }
    }
  }

  private pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }
  private rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private render(s: string): void {
    this.gfx.clear();

    if (this.m.player.is_visible()) this.drawPlayer();

    for (const r of this.enemies) {
      const st = r.e.get_state();
      if (st === "active" || st === "spawning") this.drawEnemy(r.x, r.y, r.e.get_kind(), st === "spawning");
      else if (st === "dying") this.drawExplosion(r.x + ENEMY.w / 2, r.y + ENEMY.h / 2);
    }

    if (this.bossVisible && !this.m.boss.is_gone()) this.drawBoss();

    this.gfx.fillStyle(0xfff04d, 1);
    for (const b of this.playerBullets) this.gfx.fillRect(b.x - 4, b.y - 1.5, 8, 3);
    this.gfx.fillStyle(0xff6b6b, 1);
    for (const b of this.enemyBullets) this.gfx.fillRect(b.x - 2.5, b.y - 2.5, 5, 5);

    let phaseStr = "";
    if (s === "boss_fight" && this.bossVisible) {
      phaseStr = `   BOSS P${this.m.boss.get_phase()}  HP ${Math.round(this.m.boss.get_hp_fraction() * 100)}%`;
    }
    this.hudText.setText(
      `SCORE ${String(this.m.get_score()).padStart(5, "0")}   LIVES ${this.m.get_lives()}   ENEMIES ${this.m.enemy_count()}${phaseStr}`,
    );
    this.centerText.setText(this.centerMsg(s));
  }

  private centerMsg(s: string): string {
    switch (s) {
      case "attract":
        return "S H O O T E R\n\nArrows/WASD move · hold SPACE fire\n\nPress SPACE to start";
      case "paused":
        return "PAUSED\n\nP to resume";
      case "victory":
        return "VICTORY!\n\nPress R to play again";
      case "game_over":
        return "GAME OVER\n\nPress R to restart";
      case "boss_fight":
        return this.m.boss.is_dying() ? "B O S S   D E F E A T E D" : "";
      default:
        return "";
    }
  }

  private drawPlayer(): void {
    const st = this.m.player.get_state();
    if (st === "exploding") {
      this.drawExplosion(this.px + PLAYER.w / 2, this.py + PLAYER.h / 2);
      return;
    }
    if (st === "invulnerable" && Math.floor(this.time.now / 100) % 2 === 0) return; // blink
    this.gfx.fillStyle(0x66ff66, 1);
    this.gfx.fillTriangle(this.px, this.py, this.px, this.py + PLAYER.h, this.px + PLAYER.w, this.py + PLAYER.h / 2);
  }

  private drawEnemy(x: number, y: number, kind: number, spawning: boolean): void {
    let col = 0xff6666;
    if (kind === 1) col = 0xe5b34d;
    else if (kind === 2) col = 0x80b3ff;
    this.gfx.fillStyle(spawning ? 0xffffff : col, spawning ? 0.6 : 1);
    this.gfx.fillRect(x, y, ENEMY.w, ENEMY.h);
    this.gfx.fillStyle(col, 1);
    this.gfx.fillRect(x + 4, y + 4, ENEMY.w - 8, ENEMY.h - 8);
  }

  private drawBoss(): void {
    let col = 0x666666;
    const phase = this.m.boss.get_phase();
    if (phase === 1) col = 0xb34de5;
    else if (phase === 2) col = 0xe54db3;
    else if (phase === 3) col = 0xff3333;
    this.gfx.fillStyle(col, 1);
    this.gfx.fillRect(this.bossX, this.bossY, BOSS.w, BOSS.h);
    this.gfx.fillStyle(0x000000, 0.35);
    this.gfx.fillRect(this.bossX + 15, this.bossY + 15, BOSS.w - 30, BOSS.h - 30);

    const barW = 200;
    const barX = (W - barW) / 2;
    this.gfx.fillStyle(0x333333, 1);
    this.gfx.fillRect(barX, 36, barW, 8);
    this.gfx.fillStyle(0xff4d4d, 1);
    this.gfx.fillRect(barX, 36, barW * Math.max(0, this.m.boss.get_hp_fraction()), 8);
  }

  private drawExplosion(cx: number, cy: number): void {
    this.gfx.lineStyle(2, 0xffb34d, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      this.gfx.lineBetween(cx + Math.cos(a) * 3, cy + Math.sin(a) * 3, cx + Math.cos(a) * 12, cy + Math.sin(a) * 12);
    }
  }

  private drawStarfield(): void {
    this.starGfx.fillStyle(0xccccff, 0.4);
    for (let i = 0; i < 60; i++) {
      const x = (i * 131) % W;
      const y = (i * 79 + 17) % H;
      this.starGfx.fillRect(x, y, 1, 1);
    }
  }
}
