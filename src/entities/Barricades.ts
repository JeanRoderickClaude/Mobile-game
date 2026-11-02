import Phaser from 'phaser';
import { BARRICADES, type Difficulty } from '../config';
import type { BarricadeData, Rect } from '../levels/types';
import { overlaps } from '../systems/geometry';
import { PoliceOfficer } from './PoliceOfficer';
import type { Crowd } from './Crowd';
import { inkify } from './ink';

type Phase = 'open' | 'warn' | 'closing' | 'closed' | 'opening';

const TEX_PAD = 3;
const TEX_RES = 2;
const GREEN = 0x4ade80;
const AMBER = 0xffb03a;
const RED = 0xff4a4a;

interface Item {
  data: BarricadeData;
  /** The bar as it is right now (what blocks Pip, sight and the crowd). Mutated in place. */
  rect: Rect;
  /** The bar fully closed: what the navigation grid sees. */
  full: Rect;
  /** True when the bar slides along x (from left or right), so the street runs along y. */
  slidesX: boolean;
  span: number;
  /** Cycle length (timed) and the open time with the difficulty applied. */
  openMs: number;
  closedMs: number;
  period: number;
  phase: Phase;
  /** Closed fraction, 0 open to 1 shut. */
  c: number;
  // Heavy only.
  holdLeft: number;
  warnLeft: number;
  /** The crowd pushing it right now, if any. */
  pusher: Crowd | null;
  inBlockers: boolean;
  image: Phaser.GameObjects.Image;
  /** The flashing warning stripes over the open gap. */
  warnImage: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text | null;
  lamps: Point2[];
}

interface Point2 { x: number; y: number }

/**
 * Moving barricades (chapter 6). Timed ones run a fixed cycle (open, warning, closing, closed, opening);
 * heavy ones stay shut until a marching crowd reaches them, push them open, and close again after the
 * crowd has passed. While the bar is in the way it is one of the level's blockers (movement, sight),
 * and the navigation grid counts it closed from the start of the warning until it has fully opened,
 * so officers never plan a route through a bar that is about to shut. A closing bar never crushes Pip:
 * `shove` pushes anyone inside it out along the street. All timings come from BARRICADES in config.ts.
 */
export class Barricades {
  private items: Item[] = [];
  private clock = 0;
  private navKey = '';
  private lampGfx: Phaser.GameObjects.Graphics | null = null;
  private lampKey = '';
  /** Bars Pip is inside this frame: they do not block him until he has been pushed out. */
  readonly ghost = new Set<Rect>();
  private factor: number;

  constructor(private scene: Phaser.Scene, data: BarricadeData[], difficulty: Difficulty, private blockers: Rect[]) {
    this.factor = BARRICADES.openFactor[difficulty] ?? 1;
    for (const d of data) this.items.push(this.build(d));
    for (const it of this.items) this.apply(it);
  }

  get count(): number {
    return this.items.length;
  }

  private build(d: BarricadeData): Item {
    const t = BARRICADES.thickness;
    const slidesX = d.from === 'left' || d.from === 'right';
    const span = slidesX ? d.width : d.height;
    const full: Rect = slidesX
      ? { x: d.x, y: d.y + d.height / 2 - t / 2, width: d.width, height: t }
      : { x: d.x + d.width / 2 - t / 2, y: d.y, width: t, height: d.height };
    const rhythm = BARRICADES.timed.rhythms[d.rhythm ?? 'normal'];
    const openMs = rhythm.openMs * this.factor;
    const timed = d.kind === 'timed';
    const period = timed ? openMs + BARRICADES.timed.warnMs + BARRICADES.timed.slideMs * 2 + rhythm.closedMs : 1;
    const image = this.scene.add.image(0, 0, this.panelTexture(full, d.kind, false)).setOrigin(0).setDepth(9);
    const warnImage = this.scene.add.image(full.x - TEX_PAD, full.y - TEX_PAD, this.panelTexture(full, d.kind, true)).setOrigin(0).setDepth(9).setAlpha(0.55).setVisible(false);
    // The gap's outline, drawn once: where the bar will be, visible while it is open.
    const guide = this.scene.add.graphics().setDepth(3);
    guide.lineStyle(2, 0xffd23f, 0.45);
    for (let k = 0; k < (slidesX ? full.width : full.height); k += 16) {
      if (slidesX) guide.lineBetween(full.x + k, full.y + t / 2, full.x + Math.min(k + 8, full.width), full.y + t / 2);
      else guide.lineBetween(full.x + t / 2, full.y + k, full.x + t / 2, full.y + Math.min(k + 8, full.height));
    }
    const cx = full.x + full.width / 2;
    const cy = full.y + full.height / 2;
    const lamps: Point2[] = slidesX
      ? [{ x: d.x - 9, y: cy }, { x: d.x + d.width + 9, y: cy }]
      : [{ x: cx, y: d.y - 9 }, { x: cx, y: d.y + d.height + 9 }];
    const item: Item = {
      data: d, rect: { ...full }, full, slidesX, span, openMs, closedMs: rhythm.closedMs, period,
      phase: timed ? 'open' : 'closed', c: timed ? 0 : 1, holdLeft: 0, warnLeft: 0, pusher: null, inBlockers: false,
      image, warnImage, label: null, lamps,
    };
    // Heavy bars start shut; the timed cycle is placed by update().
    if (!timed) item.rect = { ...full };
    return item;
  }

  /** The bar's texture: stripes, drawn once per size and look. `hot` is the flashing warning frame. */
  private panelTexture(r: Rect, kind: BarricadeData['kind'], hot: boolean): string {
    const w = Math.round(r.width);
    const h = Math.round(r.height);
    const key = `barricade:${kind}:${w}x${h}${hot ? ':hot' : ''}`;
    if (this.scene.textures.exists(key)) return key;
    const base = inkify(this.scene.make.graphics({}, false), 1.5);
    const stripes = this.scene.make.graphics({}, false);
    const dark = kind === 'heavy' ? 0x3a3f4a : 0x2b2d33;
    const light = hot ? 0xffffff : kind === 'heavy' ? 0xd9d4c4 : 0xe3b82a;
    const accent = hot ? 0xe0443a : dark;
    base.fillStyle(accent, 1).fillRect(0, 0, w, h);
    // Diagonal stripes along the long side, clipped to the bar.
    const long = Math.max(w, h);
    const short = Math.min(w, h);
    const sw = 12;
    stripes.fillStyle(light, 1);
    for (let s = -short; s < long + short; s += sw * 2) {
      const quad = [[s, 0], [s + sw, 0], [s + sw - short, short], [s - short, short]];
      const clipped = clip(quad, 0, long);
      if (clipped.length < 3) continue;
      const pts = clipped.map(([a, b]) => (w >= h ? new Phaser.Math.Vector2(a, b) : new Phaser.Math.Vector2(b, a)));
      stripes.fillPoints(pts, true);
    }
    // Heavy bars get rivets so they read as solid concrete and steel.
    if (kind === 'heavy') {
      stripes.fillStyle(0x1b1424, 1);
      for (let k = 10; k < long; k += 34) stripes.fillCircle(w >= h ? k : w / 2, w >= h ? h / 2 : k, 2.2);
    }
    const dt = this.scene.textures.addDynamicTexture(key, (w + TEX_PAD * 2) * TEX_RES, (h + TEX_PAD * 2) * TEX_RES)!;
    base.setScale(TEX_RES);
    stripes.setScale(TEX_RES);
    dt.draw(base, TEX_PAD * TEX_RES, TEX_PAD * TEX_RES);
    dt.draw(stripes, TEX_PAD * TEX_RES, TEX_PAD * TEX_RES);
    // The border again on top, so stripes stay inside the outline.
    const edge = this.scene.make.graphics({}, false);
    edge.lineStyle(1.6, 0x1b1424, 1).strokeRect(0, 0, w, h).setScale(TEX_RES);
    dt.draw(edge, TEX_PAD * TEX_RES, TEX_PAD * TEX_RES);
    dt.render();
    base.destroy();
    stripes.destroy();
    edge.destroy();
    return key;
  }

  /** Warning lamps and countdown labels, above the gray layer (they are lights). Call after the noir layer exists. */
  buildOverlay(): void {
    this.lampGfx = this.scene.add.graphics().setDepth(36);
    for (const it of this.items) {
      it.label = this.scene.add
        .text(it.full.x + it.full.width / 2, it.full.y + it.full.height / 2 + (it.slidesX ? -30 : 0), '', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px', color: '#ffb03a', stroke: '#000', strokeThickness: 4 })
        .setOrigin(0.5)
        .setDepth(37)
        .setVisible(false);
    }
    this.lampKey = '';
    this.drawLamps(true);
  }

  /** Every bar's state, for the balance tools and tests. */
  snapshot(): { kind: string; phase: Phase; closed: number; rect: Rect; full: Rect; countdown: number; openLeftMs: number }[] {
    return this.items.map((it) => ({ kind: it.data.kind, phase: it.phase, closed: it.c, rect: { ...it.rect }, full: it.full, countdown: this.countdown(it), openLeftMs: this.openLeft(it) }));
  }

  /** Timed bars: ms of open time left before the warning starts (0 when not open). Heavy: ms until it starts closing, or 0. */
  private openLeft(it: Item): number {
    if (it.data.kind === 'heavy') return it.phase === 'open' ? it.holdLeft + BARRICADES.heavy.warnMs : 0;
    if (it.phase !== 'open') return 0;
    return it.openMs - (((this.clock + (it.data.phaseMs ?? 0)) % it.period) + it.period) % it.period;
  }

  private countdown(it: Item): number {
    if (it.phase !== 'warn') return 0;
    if (it.data.kind === 'heavy') return Math.ceil(it.warnLeft / 1000);
    const t = (this.clock + (it.data.phaseMs ?? 0)) % it.period;
    return Math.ceil((it.openMs + BARRICADES.timed.warnMs - t) / 1000);
  }

  update(dt: number, crowds: Crowd[]): void {
    this.clock += dt;
    const marching = crowds.filter((c) => c.data.type === 'marching');
    for (const c of marching) c.halted = false;
    let moved = false;
    for (const it of this.items) {
      const before = it.c;
      if (it.data.kind === 'timed') this.stepTimed(it);
      else this.stepHeavy(it, dt, marching);
      if (it.c !== before) {
        this.apply(it);
        moved = true;
      }
    }
    if (moved) PoliceOfficer.sightVersion++;
    // The navigation grid counts a bar closed from the warning until it has fully opened.
    const closed = this.items.filter((it) => it.phase !== 'open');
    const key = closed.map((it) => this.items.indexOf(it)).join(',');
    if (key !== this.navKey) {
      this.navKey = key;
      PoliceOfficer.nav?.setMoving(closed.map((it) => it.full));
      PoliceOfficer.sightVersion++;
    }
    this.drawLamps(false);
  }

  private stepTimed(it: Item): void {
    const T = BARRICADES.timed;
    const t = (((this.clock + (it.data.phaseMs ?? 0)) % it.period) + it.period) % it.period;
    const warnEnd = it.openMs + T.warnMs;
    const closeEnd = warnEnd + T.slideMs;
    const closedEnd = closeEnd + it.closedMs;
    if (t < it.openMs) { it.phase = 'open'; it.c = 0; }
    else if (t < warnEnd) { it.phase = 'warn'; it.c = 0; }
    else if (t < closeEnd) { it.phase = 'closing'; it.c = (t - warnEnd) / T.slideMs; }
    else if (t < closedEnd) { it.phase = 'closed'; it.c = 1; }
    else { it.phase = 'opening'; it.c = 1 - (t - closedEnd) / T.slideMs; }
  }

  private stepHeavy(it: Item, dt: number, crowds: Crowd[]): void {
    const H = BARRICADES.heavy;
    const cx = it.full.x + it.full.width / 2;
    const cy = it.full.y + it.full.height / 2;
    let near = false;
    let pusher: Crowd | null = null;
    for (const c of crowds) {
      if (!c.active) continue;
      const d = Math.hypot(c.x - cx, c.y - cy);
      if (d <= H.holdRadius) near = true;
      // Reaching it: close enough and walking toward it.
      if (d <= H.reach && (cx - c.x) * c.headingX + (cy - c.y) * c.headingY > 0) pusher = c;
    }
    it.pusher = pusher;
    switch (it.phase) {
      case 'closed':
      case 'closing':
        if (pusher) it.phase = 'opening';
        else if (it.phase === 'closing') {
          it.c = Math.min(1, it.c + dt / H.closeMs);
          if (it.c >= 1) it.phase = 'closed';
        }
        break;
      case 'open':
        if (near) it.holdLeft = H.holdAfterMs * this.factor;
        else {
          it.holdLeft -= dt;
          if (it.holdLeft <= 0) { it.phase = 'warn'; it.warnLeft = H.warnMs; }
        }
        break;
      case 'warn':
        if (pusher || near) { it.phase = 'open'; it.holdLeft = H.holdAfterMs * this.factor; }
        else {
          it.warnLeft -= dt;
          if (it.warnLeft <= 0) it.phase = 'closing';
        }
        break;
      default:
        break;
    }
    if (it.phase === 'opening') {
      it.c = Math.max(0, it.c - dt / H.pushMs);
      if (it.c <= 0) { it.phase = 'open'; it.holdLeft = H.holdAfterMs * this.factor; }
      // The crowd stands and pushes until the way is clear.
      if (pusher && it.c > 0.02) pusher.halted = true;
    }
  }

  /** Puts the bar's rect and image where its closed fraction says, and in or out of the blockers. */
  private apply(it: Item): void {
    const { full, c, span } = it;
    const from = it.data.from;
    const r = it.rect;
    const len = span * c;
    if (it.slidesX) {
      r.y = full.y; r.height = full.height; r.width = len;
      r.x = from === 'left' ? full.x : full.x + full.width - len;
      it.image.setPosition(from === 'left' ? full.x - span * (1 - c) - TEX_PAD : full.x + span * (1 - c) - TEX_PAD, full.y - TEX_PAD);
    } else {
      r.x = full.x; r.width = full.width; r.height = len;
      r.y = from === 'top' ? full.y : full.y + full.height - len;
      it.image.setPosition(full.x - TEX_PAD, from === 'top' ? full.y - span * (1 - c) - TEX_PAD : full.y + span * (1 - c) - TEX_PAD);
    }
    it.image.setVisible(c > 0.001);
    const solid = len > 0.5;
    if (solid && !it.inBlockers) this.blockers.push(r);
    else if (!solid && it.inBlockers) this.blockers.splice(this.blockers.indexOf(r), 1);
    it.inBlockers = solid;
  }

  /**
   * A bar never crushes Pip. Anyone overlapping a bar is shoved out along the street, to the side nearer his centre
   * (the way he was walking when that is a tie), at BARRICADES.pushOutSpeed, and the bar does not block him until
   * he is clear. A side with a wall behind it is skipped. Call before moving the player.
   */
  shove(p: { x: number; y: number }, half: number, dt: number, walls: Rect[], headX: number, headY: number): void {
    this.ghost.clear();
    for (const it of this.items) {
      const r = it.rect;
      if (!it.inBlockers || !overlaps(p.x, p.y, half, r)) continue;
      this.ghost.add(r);
      const centre = it.slidesX ? r.y + r.height / 2 : r.x + r.width / 2;
      const at = it.slidesX ? p.y : p.x;
      const reach = (it.slidesX ? r.height : r.width) / 2 + half + 0.5;
      let side = Math.abs(at - centre) < 1 ? Math.sign(it.slidesX ? headY : headX) || -1 : Math.sign(at - centre);
      const spot = (s: number) => (it.slidesX ? { x: p.x, y: centre + s * reach } : { x: centre + s * reach, y: p.y });
      const blocked = (s: number) => walls.some((w) => overlaps(spot(s).x, spot(s).y, half, w));
      if (blocked(side) && !blocked(-side)) side = -side;
      const goal = centre + side * reach;
      const step = (BARRICADES.pushOutSpeed * dt) / 1000;
      const next = at + Math.max(-step, Math.min(step, goal - at));
      if (it.slidesX) p.y = next;
      else p.x = next;
    }
  }

  /** Lamps at both wall edges: green open, flashing amber on warning, red closed. */
  private drawLamps(force: boolean): void {
    const g = this.lampGfx;
    if (!g) return;
    const flash = Math.floor((this.clock / 1000) * BARRICADES.flashHz * 2) % 2 === 0;
    const states = this.items.map((it) => (it.phase === 'warn' ? (flash ? 'w1' : 'w0') : it.phase === 'open' ? 'g' : 'r' + (it.phase === 'closed' ? '' : 'm')));
    const key = states.join('|');
    // Label text follows the same key plus the countdown.
    const labels = this.items.map((it) => (it.phase === 'warn' ? String(this.countdown(it)) : it.data.kind === 'heavy' && it.phase === 'closed' ? 'CROWD' : ''));
    const fullKey = key + '#' + labels.join('|');
    if (!force && fullKey === this.lampKey) return;
    this.lampKey = fullKey;
    g.clear();
    this.items.forEach((it, i) => {
      const s = states[i];
      const color = s === 'g' ? GREEN : s.startsWith('w') ? AMBER : RED;
      const on = s !== 'w0';
      for (const l of it.lamps) {
        g.fillStyle(0x1b1424, 1).fillCircle(l.x, l.y, 8);
        if (on) {
          g.fillStyle(color, 0.3).fillCircle(l.x, l.y, 15);
          g.fillStyle(color, 1).fillCircle(l.x, l.y, 5.5);
        } else {
          g.fillStyle(0x4a3a1a, 1).fillCircle(l.x, l.y, 5.5);
        }
      }
      // Red and white stripes flash over the open gap while the warning runs.
      it.warnImage.setVisible(s === 'w1');
      const text = labels[i];
      it.label?.setText(text).setVisible(text !== '').setColor(it.phase === 'warn' ? '#ffb03a' : '#ffffff');
    });
  }
}

/** Sutherland-Hodgman clip of a polygon to lo <= x <= hi. */
function clip(poly: number[][], lo: number, hi: number): number[][] {
  const edge = (pts: number[][], inside: (p: number[]) => boolean, cut: (a: number[], b: number[]) => number[]) => {
    const out: number[][] = [];
    pts.forEach((cur, i) => {
      const prev = pts[(i + pts.length - 1) % pts.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    });
    return out;
  };
  const at = (x: number) => (a: number[], b: number[]) => [x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])];
  let pts = edge(poly, (p) => p[0] >= lo, at(lo));
  if (pts.length) pts = edge(pts, (p) => p[0] <= hi, at(hi));
  return pts;
}
