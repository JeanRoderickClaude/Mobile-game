import Phaser from 'phaser';
import { POSTER_MS, STAND_RADIUS, STAND_STILL_SPEED } from '../config';
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
 * the spot shows progress; walls show a faint mark until a poster goes up.
 */
export class StandSpots {
  readonly tasks: StandTask[] = [];
  /** Drawn outside the noir layer so they stay readable in gray areas. */
  readonly overlay: Phaser.GameObjects.GameObject[];
  private marks: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, posters: PosterSpot[], tags: TagSpot[]) {
    for (const p of posters) {
      const toWall = p.wall === 'left' ? -1 : 1;
      this.tasks.push({ kind: 'poster', x: p.x, y: p.y, ms: POSTER_MS, progress: 0, done: false, label: 'Hold still to put up a poster', markX: p.x + toWall * 24, markY: p.y });
    }
    for (const t of tags) {
      this.tasks.push({ kind: 'tag', x: t.x, y: t.y, ms: t.ms, progress: 0, done: false, label: `${t.label}: hold still`, markX: t.x, markY: t.y - 30, tag: t });
    }
    this.marks = scene.add.graphics().setDepth(11);
    this.ring = scene.add.graphics().setDepth(33);
    this.label = scene.add
      .text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000', strokeThickness: 3 })
      .setOrigin(0.5, 1)
      .setDepth(33);
    this.overlay = [this.ring, this.label];
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

  private drawRing(active: StandTask | null): void {
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

  /** Faint outlines where posters can go; bright posters and graffiti where they are done. */
  private drawMarks(): void {
    const g = this.marks.clear();
    for (const t of this.tasks) {
      if (t.kind === 'poster') {
        if (!t.done) {
          g.lineStyle(1.5, 0xffffff, 0.3).strokeRect(t.markX - 7, t.markY - 10, 14, 20);
          continue;
        }
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
