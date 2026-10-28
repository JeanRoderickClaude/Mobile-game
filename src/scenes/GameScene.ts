import Phaser from 'phaser';
import {
  ASSIST_ANGLE_DEG, ASSIST_BREAK_STRENGTH, ASSIST_FLOOR_FACTOR, ASSIST_PACE_MAX, ASSIST_PACE_MIN, ASSIST_SETTLE_DIST, CHARACTER_SCALE, COIN_PICKUP_RADIUS, DIFFICULTIES, type Difficulty, COLORS, GAME_WIDTH, HIDDEN_DETECTION_RATE, HIDE_SPEED_FLOOR, HIDE_SPEED_MARGIN,
  PLAYER_RADIUS, PLAYER_SPEED, SUSPICION_DECAY, WALK_FACTOR, BYSTANDER_FOLLOW_SPEED, RING_INTERVAL_MS, TRUMPET_SPEED_FACTOR, GAME_HEIGHT,
} from '../config';
import { Bystanders } from '../entities/Bystanders';
import { Character } from '../entities/Character';
import { Coin } from '../entities/Coin';
import { Crowd } from '../entities/Crowd';
import { PoliceOfficer } from '../entities/PoliceOfficer';
import { LEVELS } from '../levels';
import { resolveLevel } from '../levels/resolve';
import type { Obstacle, Rect, ResolvedLevel } from '../levels/types';
import type { Flags } from '../story/flags';
import { CHAPTERS, isPlayable, pickScene } from '../story/story';
import { finishBonus } from '../systems/economy';
import { hasLineOfSight, overlaps } from '../systems/geometry';
import { addCoins, completeChapter, equippedLook, getCoins, getDifficulty, getFlags } from '../systems/save';
import { playCoin } from '../systems/sfx';
import { VirtualJoystick } from '../systems/VirtualJoystick';
import { CoinLabel } from '../ui/widgets';
import type { ResultData } from './ResultScene';

export interface GameSceneData {
  levelIndex?: number;
  /** Overrides the saved difficulty (used by the balance tools). */
  difficulty?: Difficulty;
  /** Set when played as a story chapter: finishing completes it and plays its outro. */
  chapterIndex?: number;
  /** Overrides the saved story flags (for testing level variants). */
  flags?: Flags;
}

export class GameScene extends Phaser.Scene {
  private level!: ResolvedLevel;
  private levelIndex = 0;
  private chapterIndex: number | undefined;
  private player!: Character;
  private officers: PoliceOfficer[] = [];
  private crowds: Crowd[] = [];
  private coins: Coin[] = [];
  private runCoins = 0; // collected this run, paid out only at the finish
  private bonus = 0; // speed bonus paid at the finish
  private coinLabel!: CoinLabel;
  private blockers: Rect[] = [];
  private joystick!: VirtualJoystick;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift' | 'space' | 'x', Phaser.Input.Keyboard.Key>;
  private bystanders!: Bystanders;
  /** Trumpet: playing this frame, the noise meter (0..1) and the sound rings in flight. */
  private playing = false;
  private noise = 0;
  private ringClock = 0;
  private rings: { x: number; y: number; age: number }[] = [];
  private ringGfx!: Phaser.GameObjects.Graphics;
  private noiseBar!: Phaser.GameObjects.Graphics;
  private trumpetPointer: number | null = null; // touch on the on-screen trumpet button
  private trumpetButton: Phaser.GameObjects.Container | null = null;
  /** Set by the balance tools to play without a key or touch. */
  trumpetOverride = false;
  /** Obstacles grown by an officer's half-size, for checking who can walk straight to a noise. */
  private walkBlockers: Rect[] = [];
  private difficulty: Difficulty = 'normal';
  private catchTimeMs = 500;
  private suspicion = 0; // ms of accumulated sight, caught at catchTimeMs
  private assisting = false; // crowd pace assist is holding the player back this frame
  private assistHint!: Phaser.GameObjects.Text;
  private elapsedMs = 0;
  private finished = false;
  private timerText!: Phaser.GameObjects.Text;
  private meter!: Phaser.GameObjects.Graphics;
  private hiddenIcon!: Phaser.GameObjects.Container;
  private playerSpeed = 0; // actual units per second over the last frame
  private hidden = false;

  constructor() {
    super('game');
  }

  init(data: GameSceneData): void {
    this.levelIndex = data.levelIndex ?? 0;
    this.chapterIndex = data.chapterIndex;
    this.level = resolveLevel(LEVELS[this.levelIndex], data.flags ?? getFlags());
    this.difficulty = data.difficulty ?? getDifficulty();
    this.catchTimeMs = DIFFICULTIES[this.difficulty].catchTimeMs * this.level.catchTimeFactor;
    this.assisting = false;
    this.officers = [];
    this.crowds = [];
    this.coins = [];
    this.runCoins = 0;
    this.bonus = 0;
    this.playerSpeed = 0;
    this.hidden = false;
    this.blockers = this.level.obstacles;
    this.walkBlockers = this.blockers.map((b) => ({ x: b.x - 14, y: b.y - 14, width: b.width + 28, height: b.height + 28 }));
    this.playing = false;
    this.noise = 0;
    this.ringClock = 0;
    this.rings = [];
    this.trumpetPointer = null;
    this.trumpetButton = null;
    this.trumpetOverride = false;
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

    const rangeFactor = DIFFICULTIES[this.difficulty].visionRangeFactor;
    this.officers = this.level.officers.map((d) => new PoliceOfficer(this, { ...d, visionRange: d.visionRange * rangeFactor }));

    this.crowds = (this.level.crowds ?? []).map((d) => new Crowd(this, d));

    this.coins = (this.level.coins ?? []).map((d) => new Coin(this, d));

    this.bystanders = new Bystanders(this, this.level.bystanders ?? [], this.blockers);
    this.ringGfx = this.add.graphics().setDepth(6);

    this.player = new Character(this, this.level.start.x, this.level.start.y, equippedLook(), { marker: true }).setDepth(30);
    this.cameras.main.startFollow(this.player, true, 1, 0.15);

    this.meter = this.add.graphics().setDepth(40);
    this.hiddenIcon = this.buildHiddenIcon();

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, shift: K.SHIFT, space: K.SPACE, x: K.X,
    }) as typeof this.keys;
    if (this.level.trumpet && this.sys.game.device.input.touch) this.buildTrumpetButton();
    this.joystick = new VirtualJoystick(this, (p) => this.onTrumpetButton(p));

    this.timerText = this.add
      .text(16, 14, '', { fontFamily: 'Arial, sans-serif', fontSize: '26px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setScrollFactor(0)
      .setDepth(90);
    const chapter = this.chapterIndex !== undefined ? CHAPTERS[this.chapterIndex] : undefined;
    this.add
      .text(GAME_WIDTH - 16, 14, chapter ? `${this.chapterIndex! + 1}. ${chapter.title}` : this.level.name, { fontFamily: 'Arial, sans-serif', fontSize: '22px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(90);
    this.add
      .text(GAME_WIDTH - 16, 44, DIFFICULTIES[this.difficulty].label, { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#d0d2da', stroke: '#000', strokeThickness: 3 })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(90);
    this.coinLabel = new CoinLabel(this, 16, 64, 0).setScrollFactor(0).setDepth(90);
    if (this.level.trumpet) this.buildNoiseMeter();
    this.assistHint = this.add
      .text(GAME_WIDTH / 2, 925, '', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#7be08f', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0.85);
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    // Cap the step so a background tab or a hitch does not teleport anyone.
    const dt = Math.min(delta, 50);
    this.elapsedMs += dt;

    this.updateTrumpet(dt);
    this.movePlayer(dt);
    this.collectCoins();
    for (const o of this.officers) o.update(dt);
    for (const c of this.crowds) c.update(dt);
    const cfg = DIFFICULTIES[this.difficulty];
    this.bystanders.update(dt, this.player.x, this.player.y, this.playing, cfg.hearingRadius, cfg.lingerMs);
    this.updateDetection(dt);

    this.timerText.setText(formatTime(this.elapsedMs));

    if (this.inRect(this.player.x, this.player.y, this.level.finish)) this.end('complete');
  }

  private movePlayer(dt: number): void {
    let dx = 0;
    let dy = 0;
    let sprint: boolean;
    let keyboard = false;
    const k = this.keys;
    if (k.left.isDown || k.a.isDown) dx -= 1;
    if (k.right.isDown || k.d.isDown) dx += 1;
    if (k.up.isDown || k.w.isDown) dy -= 1;
    if (k.down.isDown || k.s.isDown) dy += 1;
    if (dx !== 0 || dy !== 0) {
      // Shift walks at crowd pace, since keys have no half-press like the joystick.
      const len = Math.hypot(dx, dy) / (k.shift.isDown ? WALK_FACTOR : 1);
      dx /= len;
      dy /= len;
      keyboard = true;
      // X breaks cover; so does Space where Space is not the trumpet.
      sprint = k.x.isDown || (!this.level.trumpet && k.space.isDown);
    } else {
      dx = this.joystick.vector.x;
      dy = this.joystick.vector.y;
      sprint = Math.hypot(dx, dy) >= ASSIST_BREAK_STRENGTH;
    }

    // Crowd pace assist: slow to the group's pace so the player stays hidden
    // without precise thumb control. Sprint or a full push breaks out.
    if (this.playing) {
      dx *= TRUMPET_SPEED_FACTOR;
      dy *= TRUMPET_SPEED_FACTOR;
    }
    const wanted = Math.hypot(dx, dy) * PLAYER_SPEED;
    const cap = sprint ? Infinity : this.assistCap(dx, dy);
    this.assisting = wanted > cap;
    if (this.assisting) {
      dx *= cap / wanted;
      dy *= cap / wanted;
    }
    const breakKey = this.level.trumpet ? 'X' : 'Space';
    this.assistHint.setText(this.assisting ? (keyboard ? `Hold ${breakKey} to break cover` : 'Push to the edge to break cover') : '');

    const step = (PLAYER_SPEED * dt) / 1000;
    const fromX = this.player.x;
    const fromY = this.player.y;
    // Move each axis separately so the player slides along walls.
    this.player.x = this.resolveAxis(this.player.x + dx * step, this.player.y, 'x');
    this.player.y = this.resolveAxis(this.player.x, this.player.y + dy * step, 'y');
    // Measured after collision, so pushing into a wall counts as standing still.
    this.playerSpeed = dt > 0 ? (Math.hypot(this.player.x - fromX, this.player.y - fromY) * 1000) / dt : 0;
    this.player.updateMotion(dx, dy, dt);
  }

  private collectCoins(): void {
    for (const c of this.coins) {
      if (c.collected || Math.hypot(c.x - this.player.x, c.y - this.player.y) > COIN_PICKUP_RADIUS) continue;
      c.collect();
      this.runCoins += c.value;
      this.coinLabel.setValue(this.runCoins);
      this.tweens.killTweensOf(this.coinLabel);
      this.coinLabel.setScale(1);
      this.tweens.add({ targets: this.coinLabel, scale: 1.25, duration: 90, yoyo: true });
      playCoin(this, c.valuable);
    }
  }

  /** Speed cap from the crowd pace assist for input (dx, dy), or Infinity when it does not apply. */
  private assistCap(dx: number, dy: number): number {
    const len = Math.hypot(dx, dy);
    if (len === 0) return Infinity;
    const minDot = Math.cos(Phaser.Math.DegToRad(ASSIST_ANGLE_DEG));
    let marching = 0;
    let standing = false;
    for (const c of this.crowds) {
      if (!c.contains(this.player.x, this.player.y)) continue;
      if (c.speed === 0) standing = true;
      else if ((dx * c.headingX + dy * c.headingY) / len >= minDot) {
        // Ahead of the centre: slower than the group; behind: a little faster. The player drifts back to the middle.
        const ahead = (this.player.x - c.x) * c.headingX + (this.player.y - c.y) * c.headingY;
        const factor = Phaser.Math.Clamp(1 - ahead / ASSIST_SETTLE_DIST, ASSIST_PACE_MIN, ASSIST_PACE_MAX);
        marching = Math.max(marching, c.speed * factor);
      }
    }
    if (marching > 0) return marching;
    // Gathered bystanders follow Pip in any direction, at their walking pace.
    if (this.bystanders.contains(this.player.x, this.player.y)) return BYSTANDER_FOLLOW_SPEED * 0.95;
    return standing ? HIDE_SPEED_FLOOR * ASSIST_FLOOR_FACTOR : Infinity;
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
    const { x, y } = this.player;
    // Hidden while inside a group and not outpacing it by more than the margin.
    this.hidden =
      this.crowds.some((c) => c.contains(x, y) && this.playerSpeed <= Math.max(c.speed * HIDE_SPEED_MARGIN, HIDE_SPEED_FLOOR)) ||
      this.bystanders.hides(x, y, this.playerSpeed);
    const seen = this.officers.some((o) => o.canSee(x, y, this.blockers));
    this.suspicion = seen
      ? this.suspicion + dt * (this.hidden ? HIDDEN_DETECTION_RATE : 1)
      : Math.max(0, this.suspicion - dt * SUSPICION_DECAY);
    const alert = Math.min(1, this.suspicion / this.catchTimeMs);

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

    this.hiddenIcon.setVisible(this.hidden).setPosition(x, y - 58 * CHARACTER_SCALE);

    if (this.suspicion >= this.catchTimeMs) this.end('caught');
  }

  /** Small bubble with three heads, shown above the player while hidden in a crowd. */
  private buildHiddenIcon(): Phaser.GameObjects.Container {
    const g = this.add.graphics();
    g.fillStyle(0x1d1f2b, 0.85).fillRoundedRect(-17, -11, 34, 22, 8);
    g.lineStyle(2, 0x7be08f, 1).strokeRoundedRect(-17, -11, 34, 22, 8);
    g.fillStyle(0x7be08f, 1);
    g.fillCircle(-9, 1, 4).fillCircle(9, 1, 4);
    g.fillStyle(0xffffff, 1).fillCircle(0, -1, 5);
    return this.add.container(0, 0, [g]).setDepth(41).setVisible(false);
  }

  /** Reads the trumpet input, fills or drains the noise meter, calls officers when it fills, draws the rings. */
  private updateTrumpet(dt: number): void {
    if (!this.level.trumpet) return;
    const cfg = DIFFICULTIES[this.difficulty];
    this.playing = this.trumpetOverride || this.keys.space.isDown || this.trumpetPointer !== null;
    this.noise = Phaser.Math.Clamp(this.noise + (dt / 1000) * (this.playing ? cfg.noiseRisePerSec : -cfg.noiseFallPerSec), 0, 1);
    if (this.noise >= 1) {
      // Too loud: officers close enough, with a clear walk, come to look where Pip is now.
      const { x, y } = this.player;
      for (const o of this.officers) {
        if (Math.hypot(o.x - x, o.y - y) <= cfg.alertRadius && hasLineOfSight(o.x, o.y, x, y, this.walkBlockers)) o.investigate(x, y);
      }
      this.noise = 0;
      this.cameras.main.flash(180, 255, 80, 80);
    }

    this.ringClock -= dt;
    if (this.playing && this.ringClock <= 0) {
      this.rings.push({ x: this.player.x, y: this.player.y, age: 0 });
      this.ringClock = RING_INTERVAL_MS;
    }
    const life = 900;
    this.ringGfx.clear();
    this.rings = this.rings.filter((r) => (r.age += dt) < life);
    for (const r of this.rings) {
      const t = r.age / life;
      this.ringGfx.lineStyle(3, 0xffd23f, 0.75 * (1 - t)).strokeCircle(r.x, r.y, 20 + (cfg.hearingRadius - 20) * t);
    }
    this.drawNoiseMeter();
  }

  private buildNoiseMeter(): void {
    this.add
      .text(GAME_WIDTH / 2, 14, 'NOISE', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px', color: COLORS.text, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(90);
    this.noiseBar = this.add.graphics().setScrollFactor(0).setDepth(90);
    if (!this.sys.game.device.input.touch) {
      this.add
        .text(GAME_WIDTH / 2, 56, 'Hold Space to play', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#d0d2da', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(90);
    }
    this.drawNoiseMeter();
  }

  private drawNoiseMeter(): void {
    if (!this.noiseBar) return;
    const w = 150;
    const x = GAME_WIDTH / 2 - w / 2;
    const g = this.noiseBar.clear();
    g.fillStyle(0x000000, 0.6).fillRect(x - 3, 35, w + 6, 18);
    const color = this.noise > 0.75 ? 0xff4a4a : this.noise > 0.5 ? 0xf2994a : 0xffd23f;
    g.fillStyle(color, 1).fillRect(x, 38, w * this.noise, 12);
    g.lineStyle(2, 0xffffff, 0.8).strokeRect(x - 3, 35, w + 6, 18);
  }

  /** Round trumpet button, bottom right, opposite the joystick. Held to play. */
  private buildTrumpetButton(): void {
    const g = this.add.graphics();
    g.fillStyle(0x1d1f2b, 0.55).fillCircle(0, 0, 54);
    g.lineStyle(3, 0xffd23f, 0.9).strokeCircle(0, 0, 54);
    // A small trumpet: mouthpiece, tube, valves and bell.
    g.fillStyle(0xffd23f, 1);
    g.fillRect(-30, -4, 44, 8).fillRect(-36, -6, 6, 12);
    g.fillRect(-12, -14, 5, 10).fillRect(-3, -14, 5, 10).fillRect(6, -14, 5, 10);
    g.fillTriangle(12, -4, 12, 4, 32, 0).fillTriangle(14, 0, 34, -16, 34, 16);
    this.trumpetButton = this.add.container(GAME_WIDTH - 78, GAME_HEIGHT - 92, [g]).setScrollFactor(0).setDepth(95);
    const release = (p: Phaser.Input.Pointer) => p.id === this.trumpetPointer && this.releaseTrumpet();
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerup', release);
      this.input.off('pointerupoutside', release);
    });
  }

  /** Called for every new touch: claims it for the trumpet if it lands on the button. */
  private onTrumpetButton(p: Phaser.Input.Pointer): boolean {
    const b = this.trumpetButton;
    if (!b || this.trumpetPointer !== null || Math.hypot(p.x - b.x, p.y - b.y) > 58) return false;
    this.trumpetPointer = p.id;
    b.setScale(0.92);
    return true;
  }

  private releaseTrumpet(): void {
    this.trumpetPointer = null;
    this.trumpetButton?.setScale(1);
  }

  private end(outcome: ResultData['outcome']): void {
    this.finished = true;
    this.scene.pause();
    // Coins only count once the route is complete; getting caught loses them all.
    this.bonus = outcome === 'complete' ? finishBonus(this.elapsedMs, this.level) : 0;
    if (outcome === 'complete') addCoins(this.runCoins + this.bonus);
    const chapter = this.chapterIndex !== undefined ? CHAPTERS[this.chapterIndex] : undefined;
    if (chapter && outcome === 'complete') completeChapter(chapter.id);
    const data: ResultData = {
      outcome,
      elapsedMs: this.elapsedMs,
      coins: this.runCoins,
      bonus: this.bonus,
      balance: getCoins(),
      levelIndex: this.levelIndex,
      hasNextLevel: this.levelIndex + 1 < LEVELS.length,
      chapterIndex: this.chapterIndex,
      hasNextChapter: this.chapterIndex !== undefined && isPlayable(this.chapterIndex + 1),
    };
    const outro = chapter && outcome === 'complete' ? pickScene(chapter.outro) : undefined;
    if (outro) this.scene.launch('dialogue', { dialogueId: outro.id, overlay: true, then: { key: 'result', data, launch: true } });
    else this.scene.launch('result', data);
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
      .text(finish.x + finish.width / 2, finish.y + (finish.height - sq) / 2, this.level.finishLabel ?? 'FINISH', {
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
    if (o.style === 'water') {
      g.clear(); // no shadow: water lies below the quay
      g.fillStyle(o.color ? color : 0x2f6f9a, 1).fillRect(o.x, o.y, o.width, o.height);
      g.fillStyle(0xffffff, 0.18);
      for (let y = o.y + 20; y < o.y + o.height; y += 46) {
        for (let x = o.x + 8 + ((y / 46) % 2) * 18; x < o.x + o.width - 20; x += 38) g.fillRoundedRect(x, y, 16, 3, 1.5);
      }
      g.fillStyle(0x6b4f35, 1).fillRect(o.x + o.width - 5, o.y, 5, o.height); // quay edge
    } else if (o.type === 'building') {
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
