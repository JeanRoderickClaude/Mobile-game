import Phaser from 'phaser';
import { GAME_WIDTH, POSTER_MS, STAND_RADIUS, STAND_STILL_SPEED } from '../config';
import type { PosterSpot, TagSpot } from '../levels/types';

export interface StandTask {
  kind: 'poster' | 'tag';
  x: number;
  y: number;
  ms: number;
  /** Standing still done so far, kept when Pip walks away. */
  progress: number;
  done: boolean;
  label: string;
  /** Where the finished poster or graffiti is drawn. */
  markX: number;
  markY: number;
  tag?: TagSpot;
}

/**
 * Spots where standing still does something: planting posters and tagging.
 * Progress builds while Pip stands still within STAND_RADIUS, pauses (and is
 * kept) when he moves or leaves, and the spot finishes once. A ring around
 * the spot shows progress. An unplanted poster spot is a pale paper outline
 * on the wall, pulsing slowly and drawn above the night darkness (without
 * lighting anything up), and off-screen ones get a small poster icon at the
 * screen edge pointing their way. Planting removes both and leaves the poster.
 */

const PAPER = 0xf2ead2; // old paper
const PULSE_MS = 2800; // one slow breath
const GUIDE_MAX = 3; // edge icons shown at once, nearest spots first
const GUIDE_MIN_GAP = 40; // icons keep this far apart on the screen edge
export class StandSpots {
  readonly tasks: StandTask[] = [];
  /** Wall y of each spot that has an edge icon this frame (for tests). */
  guided: number[] = [];
  /** Drawn outside the noir layer so they stay readable in gray areas. */
  readonly overlay: Phaser.GameObjects.GameObject[];
  private marks: Phaser.GameObjects.Graphics;
  private markers: Phaser.GameObjects.Graphics;
  private guides: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  /** What the guides and the ring were last drawn for; neither is redrawn while it is unchanged. */
  private guideKey = '';
  private ringKey = '';

  constructor(scene: Phaser.Scene, posters: PosterSpot[], tags: TagSpot[]) {
    for (const p of posters) {
      const toWall = p.wall === 'left' ? -1 : 1;
      this.tasks.push({ kind: 'poster', x: p.x, y: p.y, ms: POSTER_MS, progress: 0, done: false, label: 'Hold still to put up a poster', markX: p.x + toWall * 24, markY: p.y });
    }
    for (const t of tags) {
      this.tasks.push({ kind: 'tag', x: t.x, y: t.y, ms: t.ms, progress: 0, done: false, label: `${t.label}: hold still`, markX: t.x, markY: t.y - 30, tag: t });
    }
    this.marks = scene.add.graphics().setDepth(11);
    // Above the night overlay (depth 35), below the suspicion bar and the HUD.
    this.markers = scene.add.graphics().setDepth(36);
    this.guides = scene.add.graphics().setScrollFactor(0).setDepth(91);
    this.ring = scene.add.graphics().setDepth(33);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(33);
    this.overlay = [this.ring, this.label, this.markers, this.guides];
    this.drawMarks();
  }

  get postersDone(): number {
    return this.tasks.filter((t) => t.kind === 'poster' && t.done).length;
  }

  get posterCount(): number {
    return this.tasks.filter((t) => t.kind === 'poster').length;
  }

  /** True when a tag spot with this flag was finished this run. */
  tagged(flag: string): boolean {
    return this.tasks.some((t) => t.tag?.flag === flag && t.done);
  }

  /** Advances the spot Pip stands at. Returns the task that finished this frame, if any. */
  update(deltaMs: number, pipX: number, pipY: number, pipSpeed: number): StandTask | null {
    const here = this.tasks.find((t) => !t.done && Math.hypot(t.x - pipX, t.y - pipY) <= STAND_RADIUS);
    let finished: StandTask | null = null;
    if (here && pipSpeed <= STAND_STILL_SPEED) {
      here.progress = Math.min(here.ms, here.progress + deltaMs);
      if (here.progress >= here.ms) {
        here.done = true;
        finished = here;
        this.drawMarks();
      }
    }
    this.drawRing(here && !here.done ? here : null);
    return finished;
  }

  /**
   * Draws the pulsing outlines of unplanted poster spots and the edge icons
   * for those off-screen. view is the camera's world view.
   */
  drawGuides(view: Phaser.Geom.Rectangle, pipX: number, pipY: number, now: number): void {
    // The breathing is stepped in 32ths, so a player standing still redraws a few times a second, not every frame.
    const pulse = Math.round((0.5 + 0.5 * Math.sin((now / PULSE_MS) * Math.PI * 2)) * 32) / 32;
    const alpha = 0.4 + 0.45 * pulse;
    const key = `${pulse}|${this.tasks.map((t) => (t.done ? 1 : 0)).join('')}|${Math.round(view.x)}|${Math.round(view.y)}|${Math.round(pipX)}|${Math.round(pipY)}`;
    if (key === this.guideKey) return;
    this.guideKey = key;
    const m = this.markers.clear();
    const g = this.guides.clear();
    const off: StandTask[] = [];
    this.guided = [];
    for (const t of this.tasks) {
      if (t.kind !== 'poster' || t.done) continue;
      const onScreen = t.markY > view.y - 20 && t.markY < view.y + view.height + 20;
      if (!onScreen) {
        off.push(t);
        continue;
      }
      // A sheet of old paper with a torn corner. Outline only, so nothing around it lights up.
      const x = t.markX;
      const y = t.markY;
      m.lineStyle(2.5, PAPER, alpha).beginPath();
      m.moveTo(x - 11, y - 15).lineTo(x + 5, y - 15).lineTo(x + 11, y - 9).lineTo(x + 11, y + 15).lineTo(x - 11, y + 15).closePath().strokePath();
      m.lineStyle(2, PAPER, alpha * 0.55).lineBetween(x - 6, y - 6, x + 6, y - 6).lineBetween(x - 6, y, x + 6, y).lineBetween(x - 6, y + 6, x + 2, y + 6);
    }
    if (!off.length) return;

    // Edge icons: project each spot from the screen centre onto an inset rectangle.
    const cx = GAME_WIDTH / 2;
    const cy = view.height / 2;
    const left = 30, right = GAME_WIDTH - 30, top = 124, bottom = view.height - 150;
    const picked = off.sort((a, b) => Math.hypot(a.markX - pipX, a.markY - pipY) - Math.hypot(b.markX - pipX, b.markY - pipY)).slice(0, GUIDE_MAX);
    this.guided = picked.map((t) => t.markY);
    const icons = picked.map((t) => {
      const dx = t.markX - (view.x + cx);
      const dy = t.markY - (view.y + cy);
      const kx = dx === 0 ? Infinity : (dx > 0 ? right - cx : cx - left) / Math.abs(dx);
      const ky = dy === 0 ? Infinity : (dy > 0 ? bottom - cy : cy - top) / Math.abs(dy);
      const k = Math.min(kx, ky);
      return { x: cx + dx * k, y: cy + dy * k, angle: Math.atan2(dy, dx), vertical: kx < ky };
    });
    // Spread icons that land close together along their edge.
    for (let i = 1; i < icons.length; i++) {
      for (let j = 0; j < i; j++) {
        const a = icons[j], b = icons[i];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d >= GUIDE_MIN_GAP) continue;
        if (b.vertical) b.y = Phaser.Math.Clamp(b.y + (b.y >= a.y ? 1 : -1) * (GUIDE_MIN_GAP - d), top, bottom);
        else b.x = Phaser.Math.Clamp(b.x + (b.x >= a.x ? 1 : -1) * (GUIDE_MIN_GAP - d), left, right);
      }
    }
    for (const ic of icons) {
      g.fillStyle(0x10121a, 0.55 * (0.6 + 0.4 * pulse)).fillRoundedRect(ic.x - 12, ic.y - 16, 24, 32, 4);
      g.lineStyle(2.5, PAPER, alpha).beginPath();
      g.moveTo(ic.x - 9, ic.y - 12).lineTo(ic.x + 3, ic.y - 12).lineTo(ic.x + 9, ic.y - 6).lineTo(ic.x + 9, ic.y + 12).lineTo(ic.x - 9, ic.y + 12).closePath().strokePath();
      g.lineStyle(2, PAPER, alpha * 0.6).lineBetween(ic.x - 5, ic.y - 3, ic.x + 5, ic.y - 3).lineBetween(ic.x - 5, ic.y + 3, ic.x + 5, ic.y + 3);
      // Arrow pointing the way, just outside the icon.
      const ax = ic.x + Math.cos(ic.angle) * 24;
      const ay = ic.y + Math.sin(ic.angle) * 24;
      const nx = -Math.sin(ic.angle) * 6;
      const ny = Math.cos(ic.angle) * 6;
      g.fillStyle(PAPER, alpha).fillTriangle(ax + Math.cos(ic.angle) * 7, ay + Math.sin(ic.angle) * 7, ax + nx, ay + ny, ax - nx, ay - ny);
    }
  }

  private drawRing(active: StandTask | null): void {
    const key = `${active ? this.tasks.indexOf(active) : -1}|${this.tasks.map((t) => Math.round(t.progress / 16)).join(',')}`;
    if (key === this.ringKey) return;
    this.ringKey = key;
    const g = this.ring.clear();
    this.label.setVisible(!!active);
    // Started spots keep a faint ring, so the player can see where to come back to.
    for (const t of this.tasks) {
      if (t.done || t.progress <= 0 || t === active) continue;
      g.lineStyle(3, 0xffd23f, 0.45).beginPath().arc(t.x, t.y, 20, -Math.PI / 2, -Math.PI / 2 + (t.progress / t.ms) * Math.PI * 2).strokePath();
    }
    if (!active) return;
    g.lineStyle(6, 0x000000, 0.5).strokeCircle(active.x, active.y, 24);
    g.lineStyle(4, active.kind === 'tag' ? 0xff3fa4 : 0xffd23f, 1)
      .beginPath()
      .arc(active.x, active.y, 24, -Math.PI / 2, -Math.PI / 2 + (active.progress / active.ms) * Math.PI * 2)
      .strokePath();
    this.label.setText(active.label).setPosition(active.x, active.y - 34);
  }

  /** Planted posters and graffiti, and a faint ring at the van. */
  private drawMarks(): void {
    const g = this.marks.clear();
    for (const t of this.tasks) {
      if (t.kind === 'poster') {
        // Unplanted spots are drawn by drawGuides, above the darkness.
        if (!t.done) continue;
        g.fillStyle(0xff3fa4, 1).fillRect(t.markX - 8, t.markY - 11, 16, 22);
        g.fillStyle(0xffd23f, 1).fillCircle(t.markX, t.markY - 3, 4);
        g.fillStyle(0xffffff, 1).fillRect(t.markX - 5, t.markY + 4, 10, 2).fillRect(t.markX - 4, t.markY + 7, 8, 2);
      } else if (t.done) {
        // Graffiti on the van: a loud scribble and a star.
        g.lineStyle(4, 0x7be08f, 1).beginPath().moveTo(t.markX - 26, t.markY + 6);
        for (let i = 1; i <= 6; i++) g.lineTo(t.markX - 26 + i * 9, t.markY + (i % 2 ? -6 : 6));
        g.strokePath();
        g.fillStyle(0xff3fa4, 1).fillCircle(t.markX + 18, t.markY - 8, 6);
      } else {
        g.lineStyle(1.5, 0xff3fa4, 0.35).strokeCircle(t.x, t.y, 12);
      }
    }
  }
}
