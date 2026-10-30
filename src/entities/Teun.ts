import Phaser from 'phaser';
import { TEUN } from '../config';
import type { Point } from '../levels/types';
import type { NavGrid } from '../systems/nav';
import { Bar } from '../ui/bar';
import { Character } from './Character';
import type { PlayerLook } from './cosmetics';
import { INK, inkify } from './ink';

export type TeunMode = 'follow' | 'wait';

/** Teun's own look: a navy hoodie, curly orange hair and a bucket hat, so he cannot be mistaken for a crowd member or for Pip. */
const TEUN_LOOK: PlayerLook = { body: 'dark', outfit: 'hoodie-navy', hat: 'bucket-olive', sign: 'none', hair: 'curly', hairColor: 'orange' };

/** One 0xcdcdcd step of night brightness, applied to colours drawn in code (images take a tint instead). */
function dim(color: number, night: boolean): number {
  if (!night) return color;
  const f = 0.8;
  return (Math.floor(((color >> 16) & 255) * f) << 16) | (Math.floor(((color >> 8) & 255) * f) << 8) | Math.floor((color & 255) * f);
}

/**
 * Teun, the loud drummer of chapter 5: a protestor in the existing style with a snare drum on his belly.
 * He follows Pip along the navigation grid at TEUN.speed, or waits where he stands. While he waits a drum icon
 * above his head fills over TEUN.restlessSec; full, he drums for TEUN.drumSec (the scene turns that into
 * noise, rings and colour). Following Pip resets the icon.
 *
 * Detection, catching and the noise live in GameScene, which reads x, y, speed, dirX, dirY, hidden-ness
 * inputs and `drumming` from here. Teun is drawn outside the noir layer in colour, like Pip.
 */
export class Teun {
  readonly body: Character;
  mode: TeunMode = 'follow';
  /** 0..1: how full the drum icon is. */
  restless = 0;
  /** Milliseconds of drumming left, 0 when quiet. */
  drumLeft = 0;
  /** Units per second over the last frame, and the heading over the last moving frame. */
  speed = 0;
  dirX = 0;
  dirY = -1;
  /** Set by the scene during a chase and search: Teun always follows Pip then, whatever the button says. */
  forceFollow = false;

  private walking = false;
  private path: Point[] = [];
  private pathAt = 0;
  private goalX = NaN;
  private goalY = NaN;
  private readonly glyph: Phaser.GameObjects.Graphics;
  private readonly bar: Bar;
  private clock = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, night: boolean, private readonly restlessMs = TEUN.restlessSec * 1000) {
    this.body = new Character(scene, x, y, TEUN_LOOK, { animated: true }).setDepth(29.5);
    if (night) this.body.setImageTint(0xcdcdcd);
    this.body.add(this.buildDrum(scene, night));
    this.glyph = this.buildIcon(scene, night);
    this.bar = new Bar(scene, 41);
  }

  get x(): number {
    return this.body.x;
  }

  get y(): number {
    return this.body.y;
  }

  get drumming(): boolean {
    return this.drumLeft > 0;
  }

  get waiting(): boolean {
    return this.mode === 'wait' && !this.forceFollow;
  }

  /** Objects the scene must keep out of the noir layer. */
  get objects(): Phaser.GameObjects.GameObject[] {
    return [this.body, this.glyph, ...this.bar.objects];
  }

  toggle(): void {
    this.mode = this.mode === 'follow' ? 'wait' : 'follow';
  }

  setMode(mode: TeunMode): void {
    this.mode = mode;
  }

  update(dtMs: number, pipX: number, pipY: number, nav: NavGrid | null): void {
    this.clock += dtMs;
    const fromX = this.x;
    const fromY = this.y;
    if (this.waiting) {
      this.walking = false;
      this.path = [];
      if (this.drumLeft > 0) {
        this.drumLeft = Math.max(0, this.drumLeft - dtMs);
        if (this.drumLeft === 0) this.restless = 0;
      } else {
        this.restless = Math.min(1, this.restless + dtMs / this.restlessMs);
        if (this.restless >= 1) this.drumLeft = TEUN.drumSec * 1000;
      }
    } else {
      this.restless = 0;
      this.drumLeft = 0;
      this.follow(dtMs, pipX, pipY, nav);
    }
    const moved = Math.hypot(this.x - fromX, this.y - fromY);
    this.speed = dtMs > 0 ? (moved * 1000) / dtMs : 0;
    if (moved > 0.05) {
      this.dirX = (this.x - fromX) / moved;
      this.dirY = (this.y - fromY) / moved;
      this.body.updateMotion(this.dirX, this.dirY, dtMs);
    } else if (this.drumming) {
      // Drumming: hands going, facing unchanged.
      this.body.updateMotion(1, 0, dtMs, false);
    } else {
      this.body.updateMotion(0, 0, dtMs);
    }
    this.drawIcon();
  }

  private follow(dtMs: number, pipX: number, pipY: number, nav: NavGrid | null): void {
    const d = Math.hypot(pipX - this.x, pipY - this.y);
    if (!this.walking && d > TEUN.followDist + TEUN.followSlack) this.walking = true;
    if (this.walking && d <= TEUN.followDist) this.walking = false;
    if (!this.walking) return;
    // Re-plan at most every 250 ms, or when Pip has moved well off the goal.
    if (this.clock - this.pathAt > 250 || !(Math.hypot(pipX - this.goalX, pipY - this.goalY) < 40)) {
      this.pathAt = this.clock;
      this.goalX = pipX;
      this.goalY = pipY;
      this.path = nav ? nav.findPath(this.x, this.y, pipX, pipY) : [{ x: pipX, y: pipY }];
    }
    let step = (TEUN.speed * dtMs) / 1000;
    while (step > 0 && this.path.length) {
      const t = this.path[0];
      const dx = t.x - this.x;
      const dy = t.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= step) {
        this.body.setPosition(t.x, t.y);
        this.path.shift();
        step -= dist;
      } else {
        this.body.setPosition(this.x + (dx / dist) * step, this.y + (dy / dist) * step);
        step = 0;
      }
    }
  }

  /** A snare drum on his belly: red shell, white rim and skin, crossed sticks. Facing up in local space. */
  private buildDrum(scene: Phaser.Scene, night: boolean): Phaser.GameObjects.Graphics {
    const g = inkify(scene.make.graphics({}, false), 1.25);
    g.fillStyle(dim(0xc0392b, night), 1).fillEllipse(0, -13, 20, 11);
    g.fillStyle(dim(0xf4f4f4, night), 1).fillEllipse(0, -14, 15, 7);
    g.fillStyle(dim(0xd9b36c, night), 1).fillRect(-11, -9, 5, 2).fillRect(6, -9, 5, 2);
    return g;
  }

  /** The drum icon above his head: drawn once, moved with him, the fill bar under it. */
  private buildIcon(scene: Phaser.Scene, night: boolean): Phaser.GameObjects.Graphics {
    const g = inkify(scene.make.graphics({}, false), 1.5);
    g.fillStyle(dim(0xc0392b, night), 1).fillRoundedRect(-11, -4, 22, 13, 3);
    g.fillStyle(0xf4f4f4, 1).fillEllipse(0, -4, 22, 8);
    g.fillStyle(INK, 1).fillRect(-1, -14, 2, 8);
    g.fillStyle(0xd9b36c, 1).fillRect(-10, -16, 8, 3).fillRect(2, -16, 8, 3);
    scene.add.existing(g);
    return g.setDepth(41).setVisible(false);
  }

  private drawIcon(): void {
    const show = this.waiting && (this.restless > 0 || this.drumming);
    if (!show) {
      this.glyph.setVisible(false);
      this.bar.hide();
      return;
    }
    const wobble = this.drumming ? Math.sin(this.clock / 45) * 0.14 : 0;
    const cy = this.y - 60;
    this.glyph.setVisible(true).setPosition(this.x, cy).setScale(1.25 + (this.drumming ? 0.2 : 0)).setRotation(wobble);
    const full = this.drumming ? 1 : this.restless;
    this.bar.place(this.x - 15, cy + 14, 30, 5, 2, full, this.drumming ? 0xff4a4a : full > 0.75 ? 0xf2994a : 0xffd23f);
  }
}
