import Phaser from 'phaser';
import {
  BYSTANDER_FOLLOW_SPEED, BYSTANDER_RETURN_SPEED, BYSTANDER_WANDER_SPEED, CROWD_RADIUS, GATHER_DISTANCE, GATHER_MIN, GATHER_RING,
  HIDE_SPEED_FLOOR, HIDE_SPEED_MARGIN,
} from '../config';
import type { BystanderData, Rect } from '../levels/types';
import { overlaps } from '../systems/geometry';
import { Character } from './Character';
import { randomProtestorLook } from './cosmetics';

const BODY_HALF = 8; // collision half-size against obstacles
const DEFAULT_WANDER = 25;

interface Person {
  character: Character;
  homeX: number;
  homeY: number;
  wander: number;
  state: 'idle' | 'drawn' | 'returning';
  /** Idle stroll target and pause. */
  tx: number;
  ty: number;
  pause: number;
  /** Fixed spot on the ring around Pip, as an angle. */
  angle: number;
  /** Time left with Pip after the music stops. */
  linger: number;
  rand: () => number;
}

/** Small seeded random source, so idle wandering repeats exactly in the balance tools. */
function seeded(seed: number): () => number {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * Idle locals who stroll near their spot. They block nothing and hide no one
 * on their own. While Pip plays, those within hearing walk over and stand in
 * a ring around him; at least GATHER_MIN gathered form a group that hides him
 * like a crowd moving at BYSTANDER_FOLLOW_SPEED. When the music stops they
 * stay with him for the linger time, then drift home.
 */
export class Bystanders {
  readonly people: Person[] = [];
  /** Centre of the gathered group. */
  x = 0;
  y = 0;
  private gathered = 0;
  private ground: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, data: BystanderData[], private blockers: Rect[]) {
    this.ground = scene.add.circle(0, 0, CROWD_RADIUS, 0xffffff, 0.07).setDepth(4).setVisible(false);
    data.forEach((d, i) => {
      const rand = seeded(i + 1);
      this.people.push({
        character: new Character(scene, d.x, d.y, randomProtestorLook(), { baked: true }).setDepth(25),
        homeX: d.x,
        homeY: d.y,
        wander: d.wander ?? DEFAULT_WANDER,
        state: 'idle',
        tx: d.x,
        ty: d.y,
        pause: rand() * 2000,
        angle: i * 2.39996,
        linger: 0,
        rand,
      });
    });
  }

  /** Gathered bystanders right now. */
  get count(): number {
    return this.gathered;
  }

  /** True while enough are gathered to hide Pip. */
  get active(): boolean {
    return this.gathered >= GATHER_MIN;
  }

  /** Walking pace of the gathered group (0 when there is no group). */
  get speed(): number {
    return this.active ? BYSTANDER_FOLLOW_SPEED : 0;
  }

  /** Same test as a crowd: inside the group and not outpacing it. */
  hides(px: number, py: number, playerSpeed: number): boolean {
    return this.contains(px, py) && playerSpeed <= Math.max(this.speed * HIDE_SPEED_MARGIN, HIDE_SPEED_FLOOR);
  }

  contains(px: number, py: number): boolean {
    return this.active && Math.hypot(px - this.x, py - this.y) <= CROWD_RADIUS;
  }

  update(deltaMs: number, pipX: number, pipY: number, playing: boolean, hearing: number, lingerMs: number): void {
    const dt = deltaMs / 1000;
    let sx = 0;
    let sy = 0;
    this.gathered = 0;
    for (const p of this.people) {
      const c = p.character;
      if (playing && p.state !== 'drawn' && Math.hypot(c.x - pipX, c.y - pipY) <= hearing) p.state = 'drawn';
      if (p.state === 'drawn') {
        if (playing) p.linger = lingerMs;
        else if ((p.linger -= deltaMs) <= 0) p.state = 'returning';
      }

      let gx: number;
      let gy: number;
      let speed: number;
      if (p.state === 'drawn') {
        gx = pipX + Math.cos(p.angle) * GATHER_RING;
        gy = pipY + Math.sin(p.angle) * GATHER_RING;
        speed = BYSTANDER_FOLLOW_SPEED;
      } else if (p.state === 'returning') {
        gx = p.homeX;
        gy = p.homeY;
        speed = BYSTANDER_RETURN_SPEED;
        if (Math.hypot(gx - c.x, gy - c.y) < 4) {
          p.state = 'idle';
          p.tx = c.x;
          p.ty = c.y;
          p.pause = 1000 + p.rand() * 2000;
        }
      } else {
        if (Math.hypot(p.tx - c.x, p.ty - c.y) < 3 && (p.pause -= deltaMs) <= 0) {
          const a = p.rand() * Math.PI * 2;
          const r = p.rand() * p.wander;
          p.tx = p.homeX + Math.cos(a) * r;
          p.ty = p.homeY + Math.sin(a) * r;
          p.pause = 1000 + p.rand() * 2500;
        }
        gx = p.tx;
        gy = p.ty;
        speed = BYSTANDER_WANDER_SPEED;
      }
      const moved = this.step(p, gx, gy, speed * dt);
      c.updateMotion(moved.x, moved.y, deltaMs);

      if (p.state === 'drawn' && Math.hypot(c.x - pipX, c.y - pipY) <= GATHER_DISTANCE) {
        this.gathered++;
        sx += c.x;
        sy += c.y;
      }
    }
    if (this.gathered > 0) {
      this.x = sx / this.gathered;
      this.y = sy / this.gathered;
    }
    this.ground.setVisible(this.active).setPosition(this.x, this.y);
  }

  /** Moves toward (gx, gy) by at most step, sliding along obstacles. Returns the movement. */
  private step(p: Person, gx: number, gy: number, step: number): Phaser.Math.Vector2 {
    const c = p.character;
    const dx = gx - c.x;
    const dy = gy - c.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return new Phaser.Math.Vector2(0, 0);
    const k = Math.min(1, step / dist);
    const fromX = c.x;
    const fromY = c.y;
    const nx = c.x + dx * k;
    if (!this.blockers.some((b) => overlaps(nx, c.y, BODY_HALF, b))) c.x = nx;
    const ny = c.y + dy * k;
    if (!this.blockers.some((b) => overlaps(c.x, ny, BODY_HALF, b))) c.y = ny;
    return new Phaser.Math.Vector2(c.x - fromX, c.y - fromY);
  }
}
