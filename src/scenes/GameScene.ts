import Phaser from 'phaser';
import {
  ASSIST_ANGLE_DEG, ASSIST_BREAK_STRENGTH, ASSIST_FLOOR_FACTOR, ASSIST_PACE_MAX, ASSIST_PACE_MIN, ASSIST_SETTLE_DIST, CHARACTER_SCALE, COIN_PICKUP_RADIUS, DIFFICULTIES, type Difficulty, COLORS, GAME_WIDTH, HIDDEN_DETECTION_RATE, HIDE_SPEED_FLOOR, HIDE_SPEED_MARGIN,
  NOISE_WALK_FACTOR, OFFICER_RADIUS, POSTER_ZONE, PLAYER_RADIUS, PLAYER_SPEED, SUSPICION_DECAY, WALK_FACTOR, RING_INTERVAL_MS, RING_LIFE_MS, TRUMPET_SPEED_FACTOR, GAME_HEIGHT,
  CASE_DRAIN_FACTOR, CASE_REACH, CASE_SPEED_FACTOR, TEUN,
} from '../config';
import { Bystanders } from '../entities/Bystanders';
import { Character } from '../entities/Character';
import { Coin } from '../entities/Coin';
import { drawCase, makeCaseImage } from '../entities/CaseItem';
import { Crowd } from '../entities/Crowd';
import { inkify } from '../entities/ink';
import { PoliceOfficer } from '../entities/PoliceOfficer';
import { Teun } from '../entities/Teun';
import { LEVELS } from '../levels';
import { resolveLevel } from '../levels/resolve';
import type { Obstacle, Point, Rect, ResolvedLevel } from '../levels/types';
import type { Flags } from '../story/flags';
import { CHAPTERS, isPlayable, pickScene } from '../story/story';
import { finishBonus } from '../systems/economy';
import { overlaps } from '../systems/geometry';
import { Noir } from '../systems/noir';
import { bakeAtlas, type BakeItem } from '../systems/bake';
import { Bar } from '../ui/bar';
import { HintCard } from '../ui/hintCard';
import { Atmosphere } from '../systems/atmosphere';
import { StandSpots } from '../entities/StandSpots';
import { NavGrid } from '../systems/nav';
import { addCoins, completeChapter, equippedLook, getCoins, getDifficulty, getFlags, getShowFps, hasSeenHint, markHintSeen, setFlags } from '../systems/save';
import { playCoin } from '../systems/sfx';
import { VirtualJoystick } from '../systems/VirtualJoystick';
import { CoinLabel } from '../ui/widgets';
import type { ResultData } from './ResultScene';

/** Id in the save's hintsSeen for the teaching moment about where officers go when they hear the trumpet. */
const NOISE_HINT = 'noise-target';

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
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd' | 'shift' | 'space' | 'x' | 'e' | 't', Phaser.Input.Keyboard.Key>;
  private bystanders!: Bystanders;
  /** Trumpet: playing this frame, the noise meter (0..1) and the sound rings in flight. */
  private playing = false;
  private noise = 0;
  private ringClock = 0;
  private rings: { x: number; y: number; age: number }[] = [];
  private ringGfx!: Phaser.GameObjects.Graphics;
  private noiseBar!: Bar;
  /** What the colour progress bar last showed, so it is only redrawn when that changes. */
  private colorBarKey = -1;
  private ringsDrawn = false;
  private trumpetPointer: number | null = null; // touch on the on-screen trumpet button
  private trumpetButton: Phaser.GameObjects.Container | null = null;
  /** Ruby's case (chapter 4): carried or lying where it was dropped, the ground and carried images, and what the action button does now. */
  private carrying = false;
  private caseX = 0;
  private caseY = 0;
  private caseGround: Phaser.GameObjects.Image | null = null;
  private caseCarried: Phaser.GameObjects.Image | null = null;
  private caseMode: 'pick' | 'drop' | null = null;
  private caseHint: Phaser.GameObjects.Text | null = null;
  private buttonTrumpet: Phaser.GameObjects.Graphics | null = null;
  private buttonCase: Phaser.GameObjects.Container | null = null;
  /** Set by the balance tools to play without a key or touch. */
  trumpetOverride = false;
  /** Chase levels: where the chasing officers last saw Pip, and for how long none has. */
  private chaseLastX = 0;
  private chaseLastY = 0;
  private chaseLostMs = 0;
  /** Pip's heading and speed when a chaser last saw him, and his heading over the last moving frame. */
  private chaseDirX = 0;
  private chaseDirY = 0;
  private chaseSpeed = 0;
  private moveDirX = 0;
  private moveDirY = 0;
  /** Night darkness over the screen, in levels with "night". */
  /** Poster and tag spots, the poster count in the HUD, and the closed finish. */
  private spots!: StandSpots;
  private posterText: Phaser.GameObjects.Text | null = null;
  private gate: Phaser.GameObjects.Container | null = null;
  private closedHint!: Phaser.GameObjects.Text;
  /** The gray look and its colour mask, in levels with "noir". */
  private noir: Noir | null = null;
  private atmosphere: Atmosphere | null = null;
  /** The frame rate readout (menu setting "Show FPS"), or null when it is off. */
  private fpsText: Phaser.GameObjects.Text | null = null;
  private fpsAt = 0;
  private colorBar: Phaser.GameObjects.Graphics | null = null;
  private difficulty: Difficulty = 'normal';
  private catchTimeMs = 500;
  private suspicion = 0; // ms of accumulated sight, caught at catchTimeMs
  private assisting = false; // crowd pace assist is holding the player back this frame
  private assistHint!: Phaser.GameObjects.Text;
  private elapsedMs = 0;
  private finished = false;
  private timerText!: Phaser.GameObjects.Text;
  private meter!: Bar;
  private hiddenIcon!: Phaser.GameObjects.Container;
  private playerSpeed = 0; // actual units per second over the last frame
  private hidden = false;
  /** Chase levels: stamina 0..1, whether Pip is winded (capped to crowd pace until it recovers), and its bar. */
  private stamina = 1;
  private tired = false;
  private staminaBar!: Bar;
  /** Chapter 5: Teun, whether the crowd rules hide him this frame, and the follow / wait button. */
  private teun: Teun | null = null;
  private teunHidden = false;
  private teunButton: Phaser.GameObjects.Container | null = null;
  private teunButtonKey = '';
  /** Where the sound comes from this frame (Pip's trumpet or Teun's drum), and whether there is any. */
  private soundOn = false;
  /** One-time hints: the card on screen (the level is paused while it shows), the ring on the spot officers walk to, and a noise alert waiting to be taught. */
  private hintCard: HintCard | null = null;
  private hintRing: Phaser.GameObjects.Container | null = null;
  private noiseHint: { x: number; y: number; ms: number; officers: PoliceOfficer[] } | null = null;
  private soundSrc = { x: 0, y: 0 };

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
    this.stamina = 1;
    this.tired = false;
    this.chaseLastX = this.chaseLastY = this.chaseDirX = this.chaseDirY = this.chaseSpeed = this.chaseLostMs = 0;
    this.moveDirX = this.moveDirY = 0;
    this.officers = [];
    this.crowds = [];
    this.coins = [];
    this.runCoins = 0;
    this.bonus = 0;
    this.playerSpeed = 0;
    this.hidden = false;
    this.blockers = this.level.obstacles;
    this.playing = false;
    this.noise = 0;
    this.ringClock = 0;
    this.rings = [];
    this.trumpetPointer = null;
    this.trumpetButton = null;
    this.carrying = false;
    this.caseGround = this.caseCarried = this.caseHint = this.buttonTrumpet = this.buttonCase = null;
    this.caseMode = null;
    this.teun = null;
    this.teunHidden = false;
    this.teunButton = null;
    this.teunButtonKey = '';
    this.soundOn = false;
    this.hintCard = null;
    this.hintRing = null;
    this.noiseHint = null;
    this.trumpetOverride = false;
    this.noir = null;
    this.atmosphere = null;
    this.fpsText = null;
    this.colorBar = null;
    this.posterText = null;
    this.gate = null;
    const cfg = DIFFICULTIES[this.difficulty];
    this.chaseLostMs = 0;
    PoliceOfficer.nav = new NavGrid(this.level.width, this.level.height, this.level.obstacles);
    PoliceOfficer.rules = {
      chaseSpeed: PLAYER_SPEED * cfg.chaseSpeedFactor, searchMs: cfg.searchMs, closeRange: cfg.searchCloseRange, reactMs: cfg.chaseReactMs, joinMs: cfg.chaseJoinMs,
    };
    PoliceOfficer.sight = this.level.night
      ? { night: true, lights: this.level.night.lights, darkFactor: cfg.darkRangeFactor }
      : { night: false, lights: [], darkFactor: 1 };
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
    // Buildings, cars and lamp posts: baked once into one small atlas, each shown as an image where it stands.
    const items: BakeItem[] = this.level.obstacles.map((o, i) => ({
      x: o.x, y: o.y, width: o.width + 5, height: o.height + 6, draw: (g) => this.drawObstacle(g, o, i),
    }));
    for (const l of this.level.night?.lights ?? []) items.push({ x: l.x - 6, y: l.y - 6, width: 12, height: 12, draw: (g) => this.paintLampPost(g, l) });
    bakeAtlas(this, 'obstacles', 10, items);
    this.spots = new StandSpots(this, this.level.posters?.spots ?? [], this.level.tags ?? []);
    if (this.level.posters) this.gate = this.buildGate();

    const rangeFactor = DIFFICULTIES[this.difficulty].visionRangeFactor;
    this.officers = this.level.officers.map((d) => new PoliceOfficer(this, { ...d, visionRange: d.visionRange * rangeFactor }));

    this.crowds = (this.level.crowds ?? []).map((d) => new Crowd(this, d));

    this.coins = (this.level.coins ?? []).map((d) => new Coin(this, d));

    this.bystanders = new Bystanders(this, this.level.bystanders ?? [], this.blockers);
    this.ringGfx = this.add.graphics().setDepth(6);

    this.player = new Character(this, this.level.start.x, this.level.start.y, equippedLook(), { marker: true, animated: true }).setDepth(30);
    // At night Pip sits in his own hole of light in the darkness, about 80 percent as bright as in the day.
    if (this.level.night) this.player.setImageTint(0xcdcdcd);
    this.cameras.main.startFollow(this.player, true, 1, 0.15);
    if (this.level.teun) this.teun = new Teun(this, this.level.teun.x, this.level.teun.y, !!this.level.night, TEUN.restlessSec * (TEUN.restlessFactor[this.difficulty] ?? 1) * 1000);

    if (this.level.instrumentCase) this.buildCase();
    this.meter = new Bar(this, 40);
    this.staminaBar = new Bar(this, 40);
    this.hiddenIcon = this.buildHiddenIcon();

    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = kb.addKeys({
      up: K.UP, down: K.DOWN, left: K.LEFT, right: K.RIGHT, w: K.W, a: K.A, s: K.S, d: K.D, shift: K.SHIFT, space: K.SPACE, x: K.X, e: K.E, t: K.T,
    }) as typeof this.keys;
    if (this.level.trumpet && this.sys.game.device.input.touch) this.buildTrumpetButton();
    if (this.teun) this.buildTeunButton();
    this.joystick = new VirtualJoystick(this, (p) => this.onTeunButton(p) || this.onTrumpetButton(p));

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
    if (this.level.trumpet || this.teun) this.buildNoiseMeter();
    if (this.level.posters) {
      this.posterText = this.add
        .text(16, 92, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: COLORS.text, stroke: '#000', strokeThickness: 4 })
        .setScrollFactor(0)
        .setDepth(90);
      this.updatePosterText();
    }
    this.closedHint = this.add
      .text(GAME_WIDTH / 2, 890, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffd23f', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
    if (getShowFps()) {
      this.fpsText = this.add
        .text(8, GAME_HEIGHT - 8, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#9fe3ff', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0, 1)
        .setScrollFactor(0)
        .setDepth(95);
    }
    this.assistHint = this.add
      .text(GAME_WIDTH / 2, 925, '', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#7be08f', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90)
      .setAlpha(0.85);

    if (this.level.noir || this.level.night) {
      // Everything in the world goes into the filtered layer, except Pip, his
      // suspicion bar and hidden icon (always in colour) and the HUD (scroll factor 0).
      const keep = new Set<Phaser.GameObjects.GameObject>([this.player, ...this.meter.objects, ...this.staminaBar.objects, this.hiddenIcon, ...this.spots.overlay, ...(this.teun?.objects ?? [])]);
      const world = this.children.list.filter((o) => !keep.has(o) && (o as unknown as { scrollFactorX?: number }).scrollFactorX !== 0);
      const cfg = DIFFICULTIES[this.difficulty];
      const night = this.level.night ? { lamps: this.level.night.lights, darkness: cfg.darkness, pipRadius: cfg.pipLightRadius, width: this.level.width, height: this.level.height } : null;
      this.noir = new Noir(this, this.level.noir?.zones ?? [], night, !!this.level.noir);
      this.noir.adopt(world);
      this.noir.layer.setDepth(29);
      if (this.level.noir) this.atmosphere = new Atmosphere(this, this.level, this.noir);
    }
  }

  update(_time: number, delta: number): void {
    // A hint card pauses everything until it is closed.
    if (this.finished || this.hintCard) return;
    // Cap the step so a background tab or a hitch does not teleport anyone.
    const dt = Math.min(delta, 50);
    this.elapsedMs += dt;

    this.updateCase();
    this.updateTeun(dt);
    this.updateTrumpet(dt);
    this.movePlayer(dt);
    this.collectCoins();
    for (const o of this.officers) o.update(dt);
    for (const c of this.crowds) c.update(dt);
    const cfg = DIFFICULTIES[this.difficulty];
    this.bystanders.update(dt, this.player.x, this.player.y, this.playing, this.hearingRadius, cfg.lingerMs);
    this.updateSpots(dt);
    this.noir?.update(dt, this.cameras.main.worldView, this.player.x, this.player.y, this.soundOn, this.hearingRadius, this.rings, RING_LIFE_MS, this.officers, this.soundSrc);
    this.atmosphere?.update(dt);
    this.updateDetection(dt);
    this.updateHints(dt);

    this.timerText.setText(formatTime(this.elapsedMs));
    if (this.fpsText && this.time.now - this.fpsAt > 400) {
      this.fpsAt = this.time.now;
      this.fpsText.setText(`${Math.round(this.game.loop.actualFps)} fps`);
    }

    const atFinish = this.inRect(this.player.x, this.player.y, this.level.finish);
    const open = this.finishOpen();
    // With Teun in the level the exit opens only when he has caught up with Pip.
    const teunHere = !this.teun || Math.hypot(this.teun.x - this.player.x, this.teun.y - this.player.y) <= TEUN.finishRange;
    this.closedHint.setText(atFinish && !open ? `Put up ${this.level.posters!.required} posters first` : atFinish && !teunHere ? 'Wait for Teun' : '');
    if (atFinish && open && teunHere) this.end('complete');
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
      // X breaks cover in every chapter; Space only ever plays the trumpet.
      sprint = k.x.isDown;
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
    // Carrying Ruby's case lowers Pip's top speed to a fraction (the crowd assist below still works on the real speed).
    const load = this.carrying ? CASE_SPEED_FACTOR : 1;
    dx *= load;
    dy *= load;
    const wanted = Math.hypot(dx, dy) * PLAYER_SPEED;
    const cap = sprint ? Infinity : this.assistCap(dx, dy);
    this.assisting = wanted > cap;
    if (this.assisting) {
      dx *= cap / wanted;
      dy *= cap / wanted;
    }
    if (this.level.chaseMode) {
      // Stamina: running faster than crowd pace drains it; empty, Pip is capped near crowd pace until it recovers.
      const sc = DIFFICULTIES[this.difficulty];
      let speed = Math.hypot(dx, dy) * PLAYER_SPEED;
      const tiredCap = PLAYER_SPEED * sc.staminaTiredFactor * load;
      if (this.tired && speed > tiredCap) {
        dx *= tiredCap / speed;
        dy *= tiredCap / speed;
        speed = tiredCap;
      }
      // Stamina is spent on the effort Pip makes, not on the slower speed the load leaves him.
      this.updateStamina(dt, speed / load);
    }
    this.assistHint.setText(this.assisting ? (keyboard ? 'Hold X to break cover' : 'Push to the edge to break cover') : '');

    const step = (PLAYER_SPEED * dt) / 1000;
    const fromX = this.player.x;
    const fromY = this.player.y;
    // Move each axis separately so the player slides along walls.
    this.player.x = this.resolveAxis(this.player.x + dx * step, this.player.y, 'x');
    this.player.y = this.resolveAxis(this.player.x, this.player.y + dy * step, 'y');
    // Measured after collision, so pushing into a wall counts as standing still.
    this.playerSpeed = dt > 0 ? (Math.hypot(this.player.x - fromX, this.player.y - fromY) * 1000) / dt : 0;
    const moved = Math.hypot(this.player.x - fromX, this.player.y - fromY);
    if (moved > 0.05) {
      this.moveDirX = (this.player.x - fromX) / moved;
      this.moveDirY = (this.player.y - fromY) / moved;
    }
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
    if (this.bystanders.contains(this.player.x, this.player.y)) return this.bystanders.speed * 0.95;
    return standing ? HIDE_SPEED_FLOOR * ASSIST_FLOOR_FACTOR : Infinity;
  }

  /** Drains stamina above crowd pace, recovers it at or below (twice as fast hidden or in darkness), and draws the bar under Pip. */
  private updateStamina(dt: number, speed: number): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const pace = PLAYER_SPEED * WALK_FACTOR;
    if (speed > pace * 1.02) {
      this.stamina -= ((speed - pace) / (PLAYER_SPEED - pace)) * (dt / 1000) / cfg.staminaDrainSec * (this.carrying ? CASE_DRAIN_FACTOR : 1);
    } else {
      const rest = this.hidden || (!!this.level.night && PoliceOfficer.rangeFactorAt(this.player.x, this.player.y) < 1);
      this.stamina += (dt / 1000) * (rest ? cfg.staminaRestFactor : 1) / cfg.staminaRecoverSec;
    }
    this.stamina = Phaser.Math.Clamp(this.stamina, 0, 1);
    if (this.stamina <= 0) this.tired = true;
    else if (this.tired && this.stamina >= cfg.staminaResume) this.tired = false;
  }

  private drawStamina(): void {
    if (!this.level.chaseMode) return;
    const color = this.tired ? 0xe05a4f : this.stamina < 0.3 ? 0xffd23f : 0x7be08f;
    this.staminaBar.place(this.player.x - 20, this.player.y + 30 * CHARACTER_SCALE, 40, 5, 2, this.stamina, color);
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
    // Who notices Pip this frame. Searching officers only notice a hidden player (crowd, or dark at night) at close range.
    const noticingPip = this.officers.filter((o) => o.notices(x, y, this.blockers, this.hidden));
    // Teun is seen by the same rules (cones, night range, crowds, close range for searchers).
    const teun = this.teun;
    const noticingTeun = teun ? this.officers.filter((o) => o.notices(teun.x, teun.y, this.blockers, this.teunHidden)) : [];
    const noticing = teun ? [...new Set([...noticingPip, ...noticingTeun])] : noticingPip;
    // In chase levels only officers that are not already chasing or searching fill the meter.
    const pipSeen = this.level.chaseMode ? noticingPip.some((o) => o.watching) : noticingPip.length > 0;
    const teunSeen = noticingTeun.some((o) => o.watching);
    const seen = pipSeen || teunSeen;
    const rate = Math.max(pipSeen ? (this.hidden ? HIDDEN_DETECTION_RATE : 1) : 0, teunSeen ? (this.teunHidden ? HIDDEN_DETECTION_RATE : 1) : 0);
    this.suspicion = seen
      ? this.suspicion + dt * rate
      : Math.max(0, this.suspicion - dt * SUSPICION_DECAY);
    const alert = Math.min(1, this.suspicion / this.catchTimeMs);

    for (const o of this.officers) {
      const seesPlayer = seen && noticing.includes(o);
      o.drawCone(this.blockers, o.chasing ? 1 : seesPlayer ? alert : 0);
    }

    // The bar sits over whoever is being watched: Pip, or Teun when only he is seen.
    const watched = teun && teunSeen && !pipSeen ? teun.body : this.player;
    if (alert > 0) this.meter.place(watched.x - 20, watched.y - 32 * CHARACTER_SCALE, 40, 6, 2, alert, COLORS.coneAlert);
    else this.meter.hide();

    this.drawStamina();
    this.hiddenIcon.setVisible(this.hidden).setPosition(x, y - 58 * CHARACTER_SCALE);

    if (this.level.chaseMode) this.updateChase(dt, noticing, noticingPip, noticingTeun);
    else if (this.suspicion >= this.catchTimeMs) this.end('caught');
  }

  /**
   * Chase rule. A full meter sends the officers who see Pip after him; a chasing
   * officer alerts every officer within the difficulty's radius, who join. They all
   * run to where any chaser last saw Pip. When none sees him they keep running, at chase
   * speed, to where he would be had he held his heading and speed, for chasePursuitMs; then they all search. A searching officer who notices Pip chases again.
   * Only a chasing officer touching Pip catches him.
   */
  private updateChase(dt: number, noticing: PoliceOfficer[], noticingPip: PoliceOfficer[], noticingTeun: PoliceOfficer[]): void {
    const { x, y } = this.player;
    const cfg = DIFFICULTIES[this.difficulty];
    // Whoever an officer noticed is where he heads: Pip first, Teun when only he was seen.
    const pip = this.subjectPip();
    const teun = this.teun ? this.subjectTeun() : null;
    const target = (o: PoliceOfficer) => (noticingPip.includes(o) || !teun ? pip : teun);
    if (this.suspicion >= this.catchTimeMs) {
      const first = noticing.find((o) => o.watching);
      for (const o of noticing) if (o.watching) o.beginChase(target(o).x, target(o).y, cfg.chaseReactMs);
      this.markSeen(first ? target(first) : pip);
      this.suspicion = 0;
    }
    for (const o of noticing) if (o.searching) o.beginChase(target(o).x, target(o).y, cfg.chaseReactMs);

    let chasers = this.officers.filter((o) => o.chasing);
    if (!chasers.length) return;
    // Officers within reach of a chaser join, wherever they are in their routine.
    for (const o of this.officers) {
      if (o.chasing) continue;
      if (chasers.some((c) => Math.hypot(c.x - o.x, c.y - o.y) <= cfg.chaseAlertRadius)) o.beginChase(this.chaseLastX, this.chaseLastY, cfg.chaseJoinMs);
    }
    chasers = this.officers.filter((o) => o.chasing);

    if (chasers.some((o) => noticingPip.includes(o))) {
      this.markSeen(pip);
    } else if (teun && chasers.some((o) => noticingTeun.includes(o))) {
      this.markSeen(teun);
    } else {
      this.chaseLostMs += dt;
    }
    // Sight lost: run to where Pip would be by now on his last heading, not to where he was.
    const along = Math.min(this.chaseSpeed * (this.chaseLostMs / 1000), this.clearReach(this.chaseSpeed * (cfg.chasePursuitMs / 1000)));
    const tx = this.chaseLastX + this.chaseDirX * along, ty = this.chaseLastY + this.chaseDirY * along;
    for (const o of chasers) o.chaseTo(tx, ty);
    if (this.chaseLostMs >= cfg.chasePursuitMs) {
      this.startSearch(chasers);
      this.chaseLostMs = 0;
    }
    // An officer reaching either of them ends the run.
    const t = this.teun;
    if (chasers.some((o) => Math.hypot(o.x - x, o.y - y) <= PLAYER_RADIUS + OFFICER_RADIUS || (t && Math.hypot(o.x - t.x, o.y - t.y) <= TEUN.radius + OFFICER_RADIUS))) this.end('caught');
  }

  /** How far (up to max units, in steps of 20) the line from the last seen spot along Pip's heading stays clear of walls. */
  private clearReach(max: number): number {
    const nav = PoliceOfficer.nav;
    if (!nav) return max;
    let len = 0;
    for (let d = 20; d <= max; d += 20) {
      const px = this.chaseLastX + this.chaseDirX * d, py = this.chaseLastY + this.chaseDirY * d;
      if (!nav.isFree(px, py) || !nav.clear(this.chaseLastX, this.chaseLastY, px, py)) break;
      len = d;
    }
    return len;
  }

  /** A chaser sees Pip (or Teun) now: remember where, which way he was heading and how fast. */
  private markSeen(s: { x: number; y: number; dirX: number; dirY: number; speed: number }): void {
    this.chaseLastX = s.x;
    this.chaseLastY = s.y;
    this.chaseDirX = s.dirX;
    this.chaseDirY = s.dirY;
    this.chaseSpeed = s.speed;
    this.chaseLostMs = 0;
  }

  private subjectPip() {
    return { x: this.player.x, y: this.player.y, dirX: this.moveDirX, dirY: this.moveDirY, speed: this.playerSpeed };
  }

  private subjectTeun() {
    const t = this.teun!;
    return { x: t.x, y: t.y, dirX: t.dirX, dirY: t.dirY, speed: t.speed };
  }

  /**
   * The chasers lost Pip. Points are laid along the line he was heading (his last seen speed times
   * searchAheadSec, up to searchAheadMax, stopping at the first wall) with a point to each side of
   * the line's middle and end, and around the last seen spot. The officers split them: each starts
   * at a different one and checks the rest in turn.
   */
  private startSearch(chasers: PoliceOfficer[]): void {
    const cfg = DIFFICULTIES[this.difficulty];
    const nav = PoliceOfficer.nav;
    const x0 = this.chaseLastX, y0 = this.chaseLastY;
    const free = (x: number, y: number) => !nav || nav.isFree(x, y);
    const reach = Math.min(cfg.searchAheadMax, this.chaseSpeed * cfg.searchAheadSec);
    const len = reach >= 40 ? this.clearReach(reach) : 0;
    const pts: Point[] = [];
    const at = (d: number, side: number): void => {
      const px = x0 + this.chaseDirX * d - this.chaseDirY * side, py = y0 + this.chaseDirY * d + this.chaseDirX * side;
      if (free(px, py) && (!nav || nav.clear(x0, y0, px, py) || nav.findPath(x0, y0, px, py).length > 0)) pts.push({ x: px, y: py });
    };
    if (len >= 40) {
      // Along the line, nearest first, then the sides of its middle and end.
      for (let k = 1; k <= 3; k++) at((len * k) / 3, 0);
      at(len / 2, cfg.searchSpread);
      at(len / 2, -cfg.searchSpread);
      at(len, cfg.searchSpread);
      at(len, -cfg.searchSpread);
    }
    pts.unshift({ x: x0, y: y0 });
    const n = chasers.length;
    chasers.forEach((o, i) => {
      const from = Math.floor((i * pts.length) / n);
      o.startSearch(x0, y0, pts.map((_, k) => pts[(from + k) % pts.length]));
    });
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

  /** Hearing radius for the trumpet: larger at night, when sound carries further. */
  private get hearingRadius(): number {
    const cfg = DIFFICULTIES[this.difficulty];
    return cfg.hearingRadius * (this.level.night ? cfg.nightHearingFactor : 1);
  }

  private get alertRadius(): number {
    const cfg = DIFFICULTIES[this.difficulty];
    return cfg.alertRadius * (this.level.night ? cfg.nightAlertFactor : 1);
  }

  /** The finish is closed until enough posters are up. */
  private finishOpen(): boolean {
    return !this.level.posters || this.spots.postersDone >= this.level.posters.required;
  }

  /** Posters and tags: progress at the spot Pip stands on, and what a finished one does. */
  private updateSpots(dt: number): void {
    const done = this.spots.update(dt, this.player.x, this.player.y, this.playerSpeed);
    this.spots.drawGuides(this.cameras.main.worldView, this.player.x, this.player.y, this.time.now);
    if (!done) return;
    if (done.kind === 'poster') {
      const posters = this.level.posters!;
      if (this.spots.postersDone > posters.required) this.addRunCoins(posters.bonusCoins);
      const half = POSTER_ZONE / 2;
      this.noir?.colorArea({ x: done.markX - half, y: done.markY - half, width: POSTER_ZONE, height: POSTER_ZONE }, done.markX, done.markY);
      this.updatePosterText();
      if (this.finishOpen()) this.gate?.destroy();
      if (this.finishOpen()) this.gate = null;
    } else if (done.tag) {
      this.addRunCoins(done.tag.coins);
    }
  }

  private addRunCoins(amount: number): void {
    if (amount <= 0) return;
    this.runCoins += amount;
    this.coinLabel.setValue(this.runCoins);
    this.tweens.killTweensOf(this.coinLabel);
    this.coinLabel.setScale(1);
    this.tweens.add({ targets: this.coinLabel, scale: 1.25, duration: 90, yoyo: true });
    playCoin(this, true);
  }

  private updatePosterText(): void {
    const p = this.level.posters;
    if (!p || !this.posterText) return;
    const n = this.spots.postersDone;
    this.posterText.setText(n < p.required ? `Posters ${n}/${p.required}` : `Posters ${n}/${this.spots.posterCount}`).setColor(n < p.required ? COLORS.text : '#7be08f');
  }

  /** Bars across the finish while it is closed. */
  private buildGate(): Phaser.GameObjects.Container {
    const f = this.level.finish;
    const g = this.add.graphics();
    g.fillStyle(0x1d1f2b, 0.75).fillRect(f.x, f.y, f.width, f.height);
    g.fillStyle(0x9aa0aa, 1);
    for (let x = f.x + 8; x < f.x + f.width; x += 22) g.fillRect(x, f.y, 6, f.height);
    g.fillRect(f.x, f.y + f.height - 10, f.width, 6);
    const label = this.add
      .text(f.x + f.width / 2, f.y + f.height / 2 - 6, 'CLOSED', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px', color: '#ffd23f', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5);
    return this.add.container(0, 0, [g, label]).setDepth(12);
  }

  /** Street lamp posts (the warm pools are painted into the street). */
  private paintLampPost(g: Phaser.GameObjects.Graphics, l: { x: number; y: number }): void {
    g.fillStyle(0x2b2d33, 1).fillCircle(l.x, l.y, 6);
    g.fillStyle(0xfff1b8, 1).fillCircle(l.x, l.y, 3.5);
  }

  /** Reads the trumpet input, fills or drains the noise meter, calls officers when it fills, draws the rings. */
  private updateTrumpet(dt: number): void {
    if (!this.level.trumpet && !this.teun) return;
    const cfg = DIFFICULTIES[this.difficulty];
    this.playing = !!this.level.trumpet && !this.carrying && (this.trumpetOverride || this.keys.space.isDown || this.trumpetPointer !== null);
    // Teun's drum is trumpet noise from where he stands, noiseStrength times as loud.
    const drum = this.teun !== null && this.teun.drumming;
    const source = drum ? this.teun!.body : this.player;
    this.soundOn = this.playing || drum;
    this.soundSrc.x = source.x;
    this.soundSrc.y = source.y;
    const rise = (this.playing ? cfg.noiseRisePerSec : 0) + (drum ? cfg.noiseRisePerSec * TEUN.noiseStrength : 0);
    this.noise = Phaser.Math.Clamp(this.noise + (dt / 1000) * (rise > 0 ? rise : -cfg.noiseFallPerSec), 0, 1);
    if (this.noise >= 1) {
      // Too loud: officers within hearing come to look where the sound is now, walking round buildings on the navigation grid.
      // One whose walk is more than NOISE_WALK_FACTOR times the hearing distance is too far round to bother.
      const { x, y } = this.soundSrc;
      const called: PoliceOfficer[] = [];
      for (const o of this.officers) {
        if (Math.hypot(o.x - x, o.y - y) <= this.alertRadius && o.walkDistanceTo(x, y) <= this.alertRadius * NOISE_WALK_FACTOR) {
          o.investigate(x, y);
          called.push(o);
        }
      }
      // The first time in a story chapter that an officer is sent to the noise, teach where he goes (see updateHints).
      if (called.length && this.chapterIndex !== undefined && !this.noiseHint && !hasSeenHint(NOISE_HINT)) this.noiseHint = { x, y, ms: 0, officers: called };
      this.noise = 0;
      this.cameras.main.flash(180, 255, 80, 80);
    }

    this.ringClock -= dt;
    if (this.soundOn && this.ringClock <= 0) {
      this.rings.push({ x: source.x, y: source.y, age: 0 });
      this.ringClock = RING_INTERVAL_MS;
    }
    this.rings = this.rings.filter((r) => (r.age += dt) < RING_LIFE_MS);
    // The rings only change while some are in flight (and once more when the last one ends).
    if (this.rings.length || this.ringsDrawn) this.ringGfx.clear();
    this.ringsDrawn = this.rings.length > 0;
    for (const r of this.rings) {
      const t = r.age / RING_LIFE_MS;
      this.ringGfx.lineStyle(3, 0xffd23f, 0.75 * (1 - t)).strokeCircle(r.x, r.y, 20 + (this.hearingRadius - 20) * t);
    }
    this.drawNoiseMeter();
  }

  /** One-time Pip thoughts: where officers go when they hear the music, and any level hint Pip has walked up to. */
  private updateHints(dt: number): void {
    if (this.chapterIndex === undefined) return;
    const nh = this.noiseHint;
    if (nh) {
      nh.ms += dt;
      const busy = nh.officers.filter((o) => o.investigating);
      if (!busy.length) {
        this.noiseHint = null; // the alert ended in a chase or was overtaken: teach it next time
      } else if (nh.officers.some((o) => o.going) && (Math.hypot(this.player.x - nh.x, this.player.y - nh.y) > 70 || nh.ms > 2500)) {
        this.noiseHint = null;
        markHintSeen(NOISE_HINT);
        // Still standing on the spot: the first thought would be wrong, so Pip says the other one.
        const onSpot = Math.hypot(this.player.x - nh.x, this.player.y - nh.y) <= 70;
        this.showHint(onSpot ? "[They're coming to where the music is. Better not be here when they arrive.]" : "[He's going where the music was. Not where I am.]", { x: nh.x, y: nh.y });
        return;
      }
    }
    const chasing = this.officers.some((o) => o.chasing || o.searching);
    for (const h of this.level.hints ?? []) {
      if (chasing || hasSeenHint(h.id) || Math.hypot(this.player.x - h.x, this.player.y - h.y) > h.radius) continue;
      if (this.teun && Math.hypot(this.player.x - this.teun.x, this.player.y - this.teun.y) > 170) continue;
      markHintSeen(h.id);
      this.showHint(h.text);
      return;
    }
  }

  /** Pauses the level under a Pip thought; a ring pulses on the target spot (world position) until it is closed. */
  private showHint(text: string, target?: Point): void {
    if (target) {
      const g = this.add.graphics();
      g.fillStyle(0xffd23f, 0.22).fillCircle(0, 0, 34);
      g.lineStyle(4, 0xffd23f, 1).strokeCircle(0, 0, 34);
      const label = this.add.text(0, -58, 'HERE', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '20px', color: '#ffd23f', stroke: '#000', strokeThickness: 4 }).setOrigin(0.5);
      this.tweens.add({ targets: g, scale: 1.5, alpha: 0.35, duration: 650, yoyo: true, repeat: -1 });
      this.hintRing = this.add.container(target.x, target.y, [g, label]).setDepth(50);
    }
    this.hintCard = new HintCard(this, text, () => {
      this.hintCard = null;
      this.hintRing?.destroy();
      this.hintRing = null;
    });
  }

  private buildNoiseMeter(): void {
    this.add
      .text(GAME_WIDTH / 2, 14, 'NOISE', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px', color: COLORS.text, stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(90);
    this.noiseBar = new Bar(this, 90, true);
    // The frame around the meter never changes, so it is drawn once, above the fill.
    this.add.graphics().setScrollFactor(0).setDepth(90).lineStyle(2, 0xffffff, 0.8).strokeRect(GAME_WIDTH / 2 - 78, 35, 156, 18);
    if (this.level.noir?.zones.some((z) => z.musicMs !== undefined)) this.colorBar = this.add.graphics().setScrollFactor(0).setDepth(90);
    if (!this.sys.game.device.input.touch) {
      this.add
        .text(GAME_WIDTH / 2, 70, 'Hold Space to play', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#d0d2da', stroke: '#000', strokeThickness: 3 })
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
    const color = this.noise > 0.75 ? 0xff4a4a : this.noise > 0.5 ? 0xf2994a : 0xffd23f;
    this.noiseBar.place(x, 38, w, 12, 3, this.noise, color);

    // Under it, while Pip stands in a gray zone music can win: how close it is to turning colour.
    const progress = this.noir?.progressAt(this.player.x, this.player.y) ?? null;
    const key = progress === null ? -1 : Math.round(w * progress);
    if (this.colorBar && key !== this.colorBarKey) {
      this.colorBarKey = key;
      this.drawColorBar(this.colorBar.clear(), x, w, progress);
    }
  }

  private drawColorBar(c: Phaser.GameObjects.Graphics, x: number, w: number, progress: number | null): void {
    if (progress !== null) {
      c.fillStyle(0x000000, 0.6).fillRect(x - 3, 56, w + 6, 10);
      const stripes = [0xff3fa4, 0xf2994a, 0xffd23f, 0x7be08f, 0x5ca9e6];
      const filled = w * progress;
      for (let i = 0; i < stripes.length; i++) {
        const from = (w / stripes.length) * i;
        if (from < filled) c.fillStyle(stripes[i], 1).fillRect(x + from, 58, Math.min(w / stripes.length, filled - from), 6);
      }
    }
  }

  /** Round trumpet button, bottom right, opposite the joystick. Held to play. */
  private buildTrumpetButton(): void {
    const ring = this.add.graphics();
    ring.fillStyle(0x1d1f2b, 0.55).fillCircle(0, 0, 54);
    ring.lineStyle(3, 0xffd23f, 0.9).strokeCircle(0, 0, 54);
    // A small trumpet: mouthpiece, tube, valves and bell.
    const g = this.add.graphics();
    g.fillStyle(0xffd23f, 1);
    g.fillRect(-30, -4, 44, 8).fillRect(-36, -6, 6, 12);
    g.fillRect(-12, -14, 5, 10).fillRect(-3, -14, 5, 10).fillRect(6, -14, 5, 10);
    g.fillTriangle(12, -4, 12, 4, 32, 0).fillTriangle(14, 0, 34, -16, 34, 16);
    this.buttonTrumpet = g;
    const parts: Phaser.GameObjects.GameObject[] = [ring, g];
    if (this.level.instrumentCase) {
      // The same button picks up and drops the case: its icon and a word replace the trumpet while that is what a press does.
      const icon = this.add.graphics().setScale(1.5).setPosition(0, -10);
      drawCase(icon);
      const word = this.add.text(0, 24, '', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '15px', color: '#ffd23f', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
      this.buttonCase = this.add.container(0, 0, [icon, word]).setVisible(false);
      parts.push(this.buttonCase);
    }
    this.trumpetButton = this.add.container(GAME_WIDTH - 78, GAME_HEIGHT - 92, parts).setScrollFactor(0).setDepth(95);
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
    if (this.caseMode) {
      this.toggleCase();
      return true;
    }
    this.trumpetPointer = p.id;
    b.setScale(0.92);
    return true;
  }

  private releaseTrumpet(): void {
    this.trumpetPointer = null;
    this.trumpetButton?.setScale(1);
  }

  /** Teun: keep him moving, apply the key, and decide whether the crowd rules hide him (same rule as Pip, on his own speed). */
  private updateTeun(dt: number): void {
    const t = this.teun;
    if (!t) return;
    if (Phaser.Input.Keyboard.JustDown(this.keys.t)) t.toggle();
    // During a chase and the search that follows, Teun always follows Pip, whatever the button says.
    t.forceFollow = this.officers.some((o) => o.chasing || o.searching);
    t.update(dt, this.player.x, this.player.y, PoliceOfficer.nav);
    this.teunHidden = this.crowds.some((c) => c.contains(t.x, t.y) && t.speed <= Math.max(c.speed * HIDE_SPEED_MARGIN, HIDE_SPEED_FLOOR));
    this.drawTeunButton();
  }

  /** Round follow / wait button above the trumpet button on the right, out of the joystick's way. */
  private buildTeunButton(): void {
    const ring = this.add.graphics();
    ring.fillStyle(0x1d1f2b, 0.6).fillCircle(0, 0, 48);
    ring.lineStyle(3, 0x62c6f0, 0.95).strokeCircle(0, 0, 48);
    // A little drum.
    const drum = inkify(this.add.graphics(), 1.5);
    drum.fillStyle(0xc0392b, 1).fillRoundedRect(-14, -12, 28, 17, 4);
    drum.fillStyle(0xf4f4f4, 1).fillEllipse(0, -12, 28, 10);
    drum.fillStyle(0xd9b36c, 1).fillRect(-14, -22, 10, 4).fillRect(4, -22, 10, 4);
    drum.setPosition(0, -6);
    const word = this.add.text(0, 24, 'WAIT', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '16px', color: '#62c6f0', stroke: '#000', strokeThickness: 3 }).setOrigin(0.5);
    this.teunButton = this.add.container(GAME_WIDTH - 78, GAME_HEIGHT - 222, [ring, drum, word]).setScrollFactor(0).setDepth(95);
    this.teunButtonKey = 'follow';
    if (!this.sys.game.device.input.touch) {
      this.add
        .text(GAME_WIDTH / 2, 90, 'T: Teun waits / follows', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#d0d2da', stroke: '#000', strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setScrollFactor(0)
        .setDepth(90);
    }
  }

  private onTeunButton(p: Phaser.Input.Pointer): boolean {
    const b = this.teunButton;
    if (!b || Math.hypot(p.x - b.x, p.y - b.y) > 54) return false;
    this.teun!.toggle();
    this.tweens.add({ targets: b, scale: 0.9, duration: 70, yoyo: true });
    return true;
  }

  /** The button names what a press does now: WAIT while he follows, COME while he waits, CHASE (greyed) while the chase decides. */
  private drawTeunButton(): void {
    const b = this.teunButton;
    const t = this.teun;
    if (!b || !t) return;
    const key = t.forceFollow ? 'forced' : t.mode;
    if (key === this.teunButtonKey) return;
    this.teunButtonKey = key;
    const word = b.list[2] as Phaser.GameObjects.Text;
    word.setText(key === 'forced' ? 'RUN' : key === 'follow' ? 'WAIT' : 'COME');
    word.setColor(key === 'wait' ? '#ffd23f' : '#62c6f0');
    b.setAlpha(key === 'forced' ? 0.5 : 1);
  }

  /** Ruby's case: the image on the ground, the one Pip carries, and the hint. */
  private buildCase(): void {
    const c = this.level.instrumentCase!;
    this.caseX = c.x;
    this.caseY = c.y;
    this.caseGround = makeCaseImage(this, c.x, c.y).setDepth(8);
    this.caseCarried = makeCaseImage(this, 19, 2).setRotation(Math.PI / 2).setVisible(false);
    if (this.level.night) this.caseCarried.setTint(0xcdcdcd);
    this.player.add(this.caseCarried);
    this.caseHint = this.add
      .text(GAME_WIDTH / 2, 890, '', { fontFamily: 'Arial, sans-serif', fontSize: '20px', color: '#ffd23f', stroke: '#000', strokeThickness: 4 })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(90);
  }

  /** Picks the case up or puts it down, wherever Pip stands. Also used by the balance tools. */
  setCarrying(value: boolean): void {
    if (!this.caseGround || value === this.carrying) return;
    this.carrying = value;
    if (value) {
      this.caseGround.setVisible(false);
    } else {
      this.caseX = this.player.x;
      this.caseY = this.player.y;
      this.caseGround.setPosition(this.caseX, this.caseY).setVisible(true);
    }
    this.caseCarried!.setVisible(value);
  }

  private toggleCase(): void {
    if (this.carrying) this.setCarrying(false);
    else if (Math.hypot(this.caseX - this.player.x, this.caseY - this.player.y) <= CASE_REACH) this.setCarrying(true);
  }

  /** Key and button handling for the case, and what the button shows. */
  private updateCase(): void {
    if (!this.caseGround) return;
    const J = Phaser.Input.Keyboard.JustDown;
    if (J(this.keys.e) || (this.carrying && J(this.keys.space))) this.toggleCase();
    const near = !this.carrying && Math.hypot(this.caseX - this.player.x, this.caseY - this.player.y) <= CASE_REACH;
    const mode = this.carrying ? 'drop' : near ? 'pick' : null;
    if (mode === this.caseMode) return;
    this.caseMode = mode;
    const touch = !!this.trumpetButton;
    this.caseHint!.setText(mode === 'pick' ? (touch ? 'Tap the button to pick up the case' : 'Press E to pick up the case') : mode === 'drop' ? (touch ? 'Tap the button to drop the case' : 'Press E or Space to drop the case') : '');
    if (this.buttonCase) {
      this.buttonCase.setVisible(mode !== null);
      (this.buttonCase.list[1] as Phaser.GameObjects.Text).setText(mode === 'pick' ? 'PICK UP' : 'DROP');
      this.buttonTrumpet!.setVisible(mode === null);
    }
  }

  private end(outcome: ResultData['outcome']): void {
    this.finished = true;
    this.scene.pause();
    // Coins only count once the route is complete; getting caught loses them all.
    this.bonus = outcome === 'complete' ? finishBonus(this.elapsedMs, this.level) : 0;
    if (outcome === 'complete') addCoins(this.runCoins + this.bonus);
    const chapter = this.chapterIndex !== undefined ? CHAPTERS[this.chapterIndex] : undefined;
    if (chapter && outcome === 'complete') {
      completeChapter(chapter.id);
      // Tag choices count only on finishing: each tag's flag is true when it was done this run, false when not.
      const tags = this.level.tags ?? [];
      if (tags.length) setFlags(Object.fromEntries(tags.map((t) => [t.flag, this.spots.tagged(t.flag)])));
      // Ruby's case counts only on finishing: true when Pip carries it across the line.
      if (this.level.instrumentCase) setFlags({ [this.level.instrumentCase.flag]: this.carrying });
    }
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
    const { finish } = this.level;
    // The street is flat colour over the whole screen: as live Graphics it fills faster than a full-screen texture would.
    this.paintStreet(this.add.graphics().setDepth(0));
    const sq = 18;
    this.add
      .text(finish.x + finish.width / 2, finish.y + (finish.height - sq) / 2, this.level.finishLabel ?? 'FINISH', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '30px', color: '#1d1f2b',
      })
      .setOrigin(0.5)
      .setDepth(1);
  }

  private paintStreet(g: Phaser.GameObjects.Graphics): void {
    const { width, height, start, finish } = this.level;
    // The sidewalks are only the two side strips: the road covers the middle, so nothing is filled twice.
    g.fillStyle(COLORS.sidewalk, 1).fillRect(0, 0, 125, height).fillRect(width - 125, 0, 125, height);
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
    if (this.level.night) {
      for (const l of this.level.night.lights) {
        g.fillStyle(0xffe8a0, 0.1).fillCircle(l.x, l.y, l.radius);
        g.fillStyle(0xffe8a0, 0.1).fillCircle(l.x, l.y, l.radius * 0.6);
      }
    }
  }

  private drawObstacle(g: Phaser.GameObjects.Graphics, o: Obstacle, index: number): void {
    const palette = o.type === 'building' ? COLORS.building : COLORS.car;
    const color = o.color ? Phaser.Display.Color.HexStringToColor(o.color).color : palette[index % palette.length];
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
    } else if (o.style === 'squad-van') {
      // White van with a blue stripe, a roof light bar and a decibel meter dish.
      g.fillStyle(0xeef1f5, 1).fillRoundedRect(o.x, o.y, o.width, o.height, 6);
      const vertical = o.height >= o.width;
      g.fillStyle(0x2f5fb3, 1);
      if (vertical) g.fillRect(o.x + o.width / 2 - 4, o.y + 4, 8, o.height - 8);
      else g.fillRect(o.x + 4, o.y + o.height / 2 - 4, o.width - 8, 8);
      g.fillStyle(0x223344, 0.9);
      if (vertical) g.fillRoundedRect(o.x + 5, o.y + 6, o.width - 10, 12, 3);
      else g.fillRoundedRect(o.x + 6, o.y + 5, 12, o.height - 10, 3);
      g.fillStyle(0x4a7bd0, 1).fillRect(o.x + o.width / 2 - 9, o.y + o.height / 2 - 3, 18, 6);
      g.fillStyle(0x9aa0aa, 1).fillCircle(o.x + o.width * 0.72, o.y + o.height * 0.7, 6);
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
