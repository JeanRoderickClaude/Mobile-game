import Phaser from 'phaser';
import { CATCH_TIME_MS, CHARACTER_SCALE, COLORS, GAME_WIDTH, PLAYER_RADIUS, PLAYER_SPEED, SUSPICION_DECAY } from '../config';
import { Player } from '../entities/Player';
import { PoliceOfficer } from '../entities/PoliceOfficer';
import { LEVELS } from '../levels';
import type { LevelData, Obstacle, Rect } from '../levels/types';
import { overlaps } from '../systems/geometry';
import { VirtualJoystick } from '../systems/VirtualJoystick';
import type { ResultData } from './ResultScene';

export interface GameSceneData {
  levelIndex?: number;
}

export class GameScene extends Phaser.Scene {
  private level!: LevelData;
  private levelIndex = 0;
  private player!: Player;
  private officers: PoliceOfficer[] = [];
  private blockers: Rect[] = [];
  private joystick!: VirtualJoystick;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private suspicion = 0; // ms of accumulated sight, caught at CATCH_TIME_MS
  private elapsedMs = 0;
  private finished = false;
  private timerText!: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Graphics;

  constructor() {
    super('game');
  }

  init(data: GameSceneData): void {
    this.levelIndex = data.levelIndex ?? 0;
    this.level = LEVELS[this.levelIndex];
    this.officers = [];
    this.blockers = this.level.obstacles;
    this.suspicion = 0;
    this.elapsedMs = 0;
    this.finished = false;
  }

  create(): void {
    const { width, height } = this.level;
    // A restart from outside the result screen (dev console, tests) must not leave it open.
    this.scene.stop('result');
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.cameras.main.setBounds(0, 0, width, height);

    this.drawStreet();
    this.level.obstacles.forEach((o, i) => this.drawObstacle(o, i));

    this.officers = this.level.officers.map((d) => new PoliceOfficer(this, d));

    this.player = new Player(this, this.level.start.x, this.level.start.y).setDepth(30);
    this.cameras.main.startFollow(this.player, true, 1, 0.15);

    this.meter = this.add.graphics().setDepth(40);

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D,
    }) as typeof this.keys;
    this.joystick = new VirtualJoystick(this);

    this.timerText = this.add
      .text(16, 14, '', { fontFamily: 'Arial, sans-serif', fontSize: '26px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setScrollFactor(0)
      .setDepth(90);
    this.add
      .text(GAME_WIDTH - 16, 14, this.level.name, { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(90);
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    // Cap the step so a background tab or a hitch does not teleport anyone.
    const dt = Math.min(delta, 50);
    this.elapsedMs += dt;

    this.movePlayer(dt);
    for (const o of this.officers) o.update(dt);
    this.updateDetection(dt);

    this.timerText.setText(formatTime(this.elapsedMs));

    if (this.inRect(this.player.x, this.player.y, this.level.finish)) this.end('complete');
  }

  private movePlayer(dt: number): void {
    let dx = 0;
    let dy = 0;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) dx -= 1;
    if (k.right.isDown || k.d.isDown) dx += 1;
    if (k.up.isDown || k.w.isDown) dy -= 1;
    if (k.down.isDown || k.s.isDown) dy += 1;
    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
    } else {
      dx = this.joystick.vector.x;
      dy = this.joystick.vector.y;
    }

    const step = (PLAYER_SPEED * dt) / 1000;
    // Move each axis separately so the player slides along walls.
    this.player.x = this.resolveAxis(this.player.x + dx * step, this.player.y, 'x');
    this.player.y = this.resolveAxis(this.player.x, this.player.y + dy * step, 'y');
    this.player.updateMotion(dx, dy, dt);
  }

  /** Returns the corrected coordinate on one axis after pushing out of blockers and world edges. */
  private resolveAxis(x: number, y: number, axis: 'x' | 'y'): number {
    const r = PLAYER_RADIUS;
    let v = axis === 'x' ? x : y;
    for (const b of this.blockers) {
      const px = axis === 'x' ? v : x;
      const py = axis === 'y' ? v : y;
      if (!overlaps(px, py, r, b)) continue;
      const prev = axis === 'x' ? this.player.x : this.player.y;
      const lo = axis === 'x' ? b.x : b.y;
      const hi = lo + (axis === 'x' ? b.width : b.height);
      v = prev <= lo + (hi - lo) / 2 ? lo - r : hi + r;
    }
    const max = axis === 'x' ? this.level.width : this.level.height;
    return Phaser.Math.Clamp(v, r, max - r);
  }

  private updateDetection(dt: number): void {
    const seen = this.officers.some((o) => o.canSee(this.player.x, this.player.y, this.blockers));
    this.suspicion = seen
      ? this.suspicion + dt
      : Math.max(0, this.suspicion - dt * SUSPICION_DECAY);
    const alert = Math.min(1, this.suspicion / CATCH_TIME_MS);

    for (const o of this.officers) {
      const seesPlayer = seen && o.canSee(this.player.x, this.player.y, this.blockers);
      o.drawCone(this.blockers, seesPlayer ? alert : 0);
    }

    this.meter.clear();
    if (alert > 0) {
      const x = this.player.x - 20;
      const y = this.player.y - 32 * CHARACTER_SCALE;
      this.meter.fillStyle(0x000000, 0.6).fillRect(x - 2, y - 2, 44, 10);
      this.meter.fillStyle(COLORS.coneAlert, 1).fillRect(x, y, 40 * alert, 6);
    }

    if (this.suspicion >= CATCH_TIME_MS) this.end('caught');
  }

  private end(outcome: ResultData['outcome']): void {
    this.finished = true;
    this.scene.pause();
    const data: ResultData = {
      outcome,
      elapsedMs: this.elapsedMs,
      levelIndex: this.levelIndex,
      hasNextLevel: this.levelIndex + 1 < LEVELS.length,
    };
    this.scene.launch('result', data);
  }

  private drawStreet(): void {
    const { width, height, start, finish } = this.level;
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(COLORS.sidewalk, 1).fillRect(0, 0, width, height);
    g.fillStyle(COLORS.road, 1).fillRect(125, 0, width - 250, height);
    // Dashed centre line.
    g.fillStyle(COLORS.laneMark, 0.8);
    for (let y = 20; y < height; y += 60) g.fillRect(width / 2 - 3, y, 6, 30);

    // Start pad and finish zone with a checkered line.
    g.fillStyle(COLORS.start, 0.5).fillCircle(start.x, start.y, 34);
    g.fillStyle(COLORS.finish, 0.35).fillRect(finish.x, finish.y, finish.width, finish.height);
    const sq = 18;
    for (let x = finish.x; x < finish.x + finish.width; x += sq) {
      const odd = Math.floor((x - finish.x) / sq) % 2;
      g.fillStyle(odd ? 0x000000 : 0xffffff, 1).fillRect(x, finish.y + finish.height - sq, sq, sq / 2);
      g.fillStyle(odd ? 0xffffff : 0x000000, 1).fillRect(x, finish.y + finish.height - sq / 2, sq, sq / 2);
    }
    this.add
      .text(finish.x + finish.width / 2, finish.y + (finish.height - sq) / 2, 'FINISH', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#1d1f2b',
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  private drawObstacle(o: Obstacle, index: number): void {
    const palette = o.type === 'building' ? COLORS.building : COLORS.car;
    const color = o.color ? Phaser.Display.Color.HexStringToColor(o.color).color : palette[index % palette.length];
    const g = this.add.graphics().setDepth(10);
    // Drop shadow.
    g.fillStyle(0x000000, 0.25).fillRoundedRect(o.x + 4, o.y + 5, o.width, o.height, o.type === 'car' ? 8 : 2);
    if (o.type === 'building') {
      g.fillStyle(color, 1).fillRect(o.x, o.y, o.width, o.height);
      // Roof inset and a couple of rooftop boxes.
      g.lineStyle(3, 0x000000, 0.2).strokeRect(o.x + 6, o.y + 6, o.width - 12, o.height - 12);
      g.fillStyle(0xffffff, 0.18);
      g.fillRect(o.x + o.width * 0.25, o.y + o.height * 0.3, Math.min(24, o.width * 0.3), Math.min(18, o.height * 0.2));
      g.fillRect(o.x + o.width * 0.55, o.y + o.height * 0.65, Math.min(18, o.width * 0.25), Math.min(14, o.height * 0.15));
    } else {
      g.fillStyle(color, 1).fillRoundedRect(o.x, o.y, o.width, o.height, 8);
      // Windows: front and back windscreens along the long side.
      const vertical = o.height >= o.width;
      g.fillStyle(0x223344, 0.85);
      if (vertical) {
        g.fillRoundedRect(o.x + 5, o.y + o.height * 0.22, o.width - 10, o.height * 0.18, 3);
        g.fillRoundedRect(o.x + 5, o.y + o.height * 0.62, o.width - 10, o.height * 0.14, 3);
      } else {
        g.fillRoundedRect(o.x + o.width * 0.22, o.y + 5, o.width * 0.18, o.height - 10, 3);
        g.fillRoundedRect(o.x + o.width * 0.62, o.y + 5, o.width * 0.14, o.height - 10, 3);
      }
    }
  }

  private inRect(x: number, y: number, r: Rect): boolean {
    return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  }
}

export function formatTime(ms: number): string {
  const total = ms / 1000;
  const m = Math.floor(total / 60);
  const s = (total % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}
