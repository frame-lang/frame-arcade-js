import Phaser from "phaser";

export interface ShooterMachine {
  start(): void;
  enemy_killed(): void;
  wave_cleared(): void;
  boss_hit(): void;
  player_hit(): void;
  pause(): void;
  resume(): void;
  restart(): void;
  current_state(): string;
  score(): number;
  lives(): number;
  boss_hp(): number;
}

const W = 720;
const H = 480;
const SHIP_SPEED = 380;
const BULLET = 520;

export class ShooterScene extends Phaser.Scene {
  private m: ShooterMachine;
  private ship!: Phaser.GameObjects.Rectangle;
  private boss!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private enemies: Phaser.GameObjects.Rectangle[] = [];
  private shots: Phaser.GameObjects.Rectangle[] = [];
  private bossShots: Phaser.GameObjects.Rectangle[] = [];
  private cool = 0;
  private bossCool = 0;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private scoreText!: Phaser.GameObjects.Text;
  private stateText!: Phaser.GameObjects.Text;
  private hintText!: Phaser.GameObjects.Text;
  private prev = "";

  constructor(machine: ShooterMachine) {
    super("Shooter");
    this.m = machine;
  }

  create(): void {
    this.ship = this.add.rectangle(W / 2, H - 30, 36, 16, 0x81c995);
    this.boss = this.add.rectangle(W / 2, 70, 120, 48, 0xf28b82).setVisible(false);
    this.hpBar = this.add.rectangle(W / 2, 120, 240, 8, 0xfbbc04).setVisible(false);
    const mono = { fontFamily: "monospace", color: "#e6e1e8" };
    this.scoreText = this.add.text(12, 10, "", { ...mono, fontSize: "15px" });
    this.stateText = this.add.text(W - 12, 10, "", { ...mono, fontSize: "12px", color: "#7c8499" }).setOrigin(1, 0);
    this.hintText = this.add.text(W / 2, H / 2, "", { ...mono, fontSize: "16px", color: "#9aa4b8" }).setOrigin(0.5);

    this.keys = this.input.keyboard!.addKeys("A,D,LEFT,RIGHT,SPACE") as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.on("keydown-SPACE", () => this.onSpace());
    this.input.keyboard!.on("keydown-P", () => this.onPause());
  }

  private onSpace(): void {
    const s = this.m.current_state();
    if (s === "Title") { this.m.start(); this.spawnWave(); }
    else if (s === "Victory" || s === "GameOver") { this.m.restart(); this.reset(); }
  }
  private onPause(): void {
    const s = this.m.current_state();
    if (s === "Wave" || s === "Phase1" || s === "Phase2" || s === "Phase3") this.m.pause();
    else if (s === "Paused") this.m.resume();
  }

  private reset(): void {
    [...this.enemies, ...this.shots, ...this.bossShots].forEach((o) => o.destroy());
    this.enemies = []; this.shots = []; this.bossShots = [];
    this.boss.setVisible(false); this.hpBar.setVisible(false);
    this.ship.setPosition(W / 2, H - 30);
  }
  private spawnWave(): void {
    this.reset();
    for (let c = 0; c < 6; c++) this.enemies.push(this.add.rectangle(110 + c * 100, 70, 34, 22, 0xf28b82));
  }
  private spawnBoss(): void {
    this.boss.setVisible(true);
    this.hpBar.setVisible(true);
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.033);
    const s = this.m.current_state();
    const boss = s === "Phase1" || s === "Phase2" || s === "Phase3";

    if (boss && this.prev === "Wave") this.spawnBoss();
    this.prev = s;

    if (s === "Wave" || boss) this.step(dt, boss, s);

    this.boss.setFillStyle(s === "Phase1" ? 0xf28b82 : s === "Phase2" ? 0xfbbc04 : 0xb388ff);
    this.hpBar.width = 240 * Math.max(0, this.m.boss_hp() / 30);
    this.scoreText.setText(`score ${this.m.score()}   ships ${this.m.lives()}` + (boss ? `   boss ${this.m.boss_hp()}` : ""));
    this.stateText.setText(`state: ${s}`);
    this.hintText.setText(this.hint(s));
  }

  private step(dt: number, boss: boolean, s: string): void {
    if (this.keys.A.isDown || this.keys.LEFT.isDown) this.ship.x -= SHIP_SPEED * dt;
    if (this.keys.D.isDown || this.keys.RIGHT.isDown) this.ship.x += SHIP_SPEED * dt;
    this.ship.x = Phaser.Math.Clamp(this.ship.x, 18, W - 18);

    this.cool -= dt;
    if (this.keys.SPACE.isDown && this.cool <= 0) {
      this.cool = 0.18;
      this.shots.push(this.add.rectangle(this.ship.x, this.ship.y - 14, 4, 12, 0xffffff));
    }

    // player shots
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const b = this.shots[i];
      b.y -= BULLET * dt;
      if (b.y < -10) { b.destroy(); this.shots.splice(i, 1); continue; }
      if (!boss) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          if (this.overlap(b, this.enemies[j], 20)) {
            this.enemies[j].destroy(); this.enemies.splice(j, 1);
            b.destroy(); this.shots.splice(i, 1);
            this.m.enemy_killed();
            break;
          }
        }
      } else if (this.overlap(b, this.boss, 60)) {
        b.destroy(); this.shots.splice(i, 1);
        this.m.boss_hit();
      }
    }

    if (!boss && this.enemies.length === 0) this.m.wave_cleared();

    // boss attacks
    if (boss) {
      this.bossCool -= dt;
      const rate = s === "Phase3" ? 0.4 : s === "Phase2" ? 0.7 : 1.0;
      if (this.bossCool <= 0) {
        this.bossCool = rate;
        this.bossShots.push(this.add.rectangle(this.boss.x + Phaser.Math.Between(-40, 40), this.boss.y + 24, 5, 12, 0xff6b6b));
      }
      for (let i = this.bossShots.length - 1; i >= 0; i--) {
        const b = this.bossShots[i];
        b.y += 300 * dt;
        if (b.y > H + 10) { b.destroy(); this.bossShots.splice(i, 1); continue; }
        if (this.overlap(b, this.ship, 18)) {
          b.destroy(); this.bossShots.splice(i, 1);
          this.m.player_hit();
        }
      }
    }
  }

  private overlap(a: Phaser.GameObjects.Rectangle, b: Phaser.GameObjects.Rectangle, r: number): boolean {
    return Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < (b.height + a.height) / 2 + 4;
  }

  private hint(s: string): string {
    switch (s) {
      case "Title": return "SPACE to start";
      case "Wave": return "A/D move · hold SPACE fire · clear the wave · P pause";
      case "Phase1": case "Phase2": case "Phase3": return "Boss fight! · A/D move · hold SPACE fire";
      case "Paused": return "P to resume";
      case "Victory": return "Boss down! · SPACE to restart";
      case "GameOver": return "Game over · SPACE to restart";
      default: return "";
    }
  }
}
