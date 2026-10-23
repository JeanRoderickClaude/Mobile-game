import Phaser from 'phaser';
import { CHARACTER_SCALE, CROWD_RADIUS, CROWD_SPEED_FACTOR, PLAYER_SPEED } from '../config';
import type { CrowdData, Point } from '../levels/types';
import { Character } from './Character';
import { randomProtestorLook } from './cosmetics';

interface Member {
  character: Character;
  ox: number; // formation offset: across the path (marching) or world x (standing)
  oy: number; // back along the path (marching) or world y (standing)
  phase: number; // per-member wobble phase
}

const FADE_MS = 400;

/**
 * A group of protestors the player can hide among. Marching groups walk
 * their path, vanish at the end and restart after intervalMs. Standing
 * groups shuffle in place. Members are visual only: they block nothing.
 */
export class Crowd {
  readonly data: CrowdData;
  readonly radius: number;
  /** Group centre. */
  x: number;
  y: number;
  /** False while a marching group is between runs. */
  active = true;

  private members: Member[] = [];
  private ground: Phaser.GameObjects.Arc;
  private pathSpeed = 0;
  private leg = 0; // index of the path point being walked toward
  private waitLeft = 0;
  private time = 0;
  private dirX = 0; // current walking direction of a marching group
  private dirY = -1;
  private formX = 0; // formation heading, turns toward dir so corners are rounded
  private formY = -1;

  constructor(private scene: Phaser.Scene, data: CrowdData) {
    this.data = data;
    this.radius = data.radius ?? CROWD_RADIUS;
    const origin: Point = data.type === 'marching' ? data.path[0] : data;
    this.x = origin.x;
    this.y = origin.y;

    // Faint disc showing where the player counts as inside the group.
    this.ground = scene.add.circle(this.x, this.y, this.radius, 0xffffff, 0.07).setDepth(4);

    // Marching: a loose two-wide column, offsets in path space (ox across, oy
    // back from the centre). Standing: a sunflower blob with even spacing.
    const spacing = 15 * CHARACTER_SCALE;
    const rows = Math.ceil(data.size / 2);
    for (let i = 0; i < data.size; i++) {
      let ox: number;
      let oy: number;
      if (data.type === 'marching') {
        const row = Math.floor(i / 2);
        const single = i === data.size - 1 && data.size % 2 === 1;
        ox = (single ? 0 : i % 2 === 0 ? -1 : 1) * 17 + Phaser.Math.FloatBetween(-4, 4);
        oy = (row - (rows - 1) / 2) * 40 + Phaser.Math.FloatBetween(-6, 6);
      } else {
        const r = spacing * Math.sqrt(i + 0.5) + Phaser.Math.FloatBetween(-4, 4);
        const a = i * 2.39996 + Phaser.Math.FloatBetween(-0.2, 0.2);
        ox = Math.cos(a) * r;
        oy = Math.sin(a) * r;
      }
      const character = new Character(scene, this.x, this.y, randomProtestorLook(), { baked: true }).setDepth(25);
      // Standing members face roughly toward the middle of the gathering.
      if (data.type === 'standing') character.rotation = Math.atan2(-oy, -ox) + Math.PI / 2 + Phaser.Math.FloatBetween(-0.6, 0.6);
      this.members.push({ character, ox, oy, phase: Phaser.Math.FloatBetween(0, Math.PI * 2) });
    }

    if (data.type === 'marching') {
      this.pathSpeed = data.speed ?? PLAYER_SPEED * CROWD_SPEED_FACTOR;
      this.leg = 1;
      const first = data.path[1];
      this.dirX = first.x - this.x;
      this.dirY = first.y - this.y;
      const len = Math.hypot(this.dirX, this.dirY) || 1;
      this.dirX /= len;
      this.dirY /= len;
      this.formX = this.dirX;
      this.formY = this.dirY;
      if ((data.delayMs ?? 0) > 0) this.despawn(data.delayMs!, false);
    }
    for (const m of this.members) m.character.setPosition(...this.slot(m, 0));
  }

  /** Current speed of the group in units per second (0 for standing or waiting groups). */
  get speed(): number {
    return this.data.type === 'marching' && this.active ? this.pathSpeed : 0;
  }

  contains(px: number, py: number): boolean {
    return this.active && Math.hypot(px - this.x, py - this.y) <= this.radius;
  }

  update(deltaMs: number): void {
    this.time += deltaMs;
    if (this.data.type === 'marching') this.updateMarch(deltaMs);
    if (!this.active) return;
    this.ground.setPosition(this.x, this.y);

    const marching = this.data.type === 'marching';
    if (marching) {
      const k = Math.min(1, (deltaMs / 1000) * 3);
      this.formX += (this.dirX - this.formX) * k;
      this.formY += (this.dirY - this.formY) * k;
      const len = Math.hypot(this.formX, this.formY) || 1;
      this.formX /= len;
      this.formY /= len;
    }
    // Members chase their formation spot with a little slack, so the group
    // stretches and rounds corners instead of moving as one rigid block.
    const maxStep = ((marching ? this.pathSpeed * 1.4 : 30) * deltaMs) / 1000;
    for (const m of this.members) {
      const [tx, ty] = this.slot(m, this.time / 1000);
      const c = m.character;
      const dx = tx - c.x;
      const dy = ty - c.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0.01) {
        const step = Math.min(dist, maxStep);
        c.x += (dx / dist) * step;
        c.y += (dy / dist) * step;
      }
      // Marching members face their path direction; standing ones only shuffle.
      if (marching) c.updateMotion(this.dirX, this.dirY, deltaMs);
      else c.updateMotion(0, 0, deltaMs, false);
    }
  }

  /** World position a member is heading for at time t (seconds). */
  private slot(m: Member, t: number): [number, number] {
    const wobble = this.data.type === 'marching' ? 5 : 4;
    const wx = Math.sin(t * 1.3 + m.phase) * wobble;
    const wy = Math.cos(t * 0.9 + m.phase * 1.7) * wobble;
    if (this.data.type !== 'marching') return [this.x + m.ox + wx, this.y + m.oy + wy];
    // Across = heading rotated 90 degrees; back = minus heading.
    const ax = -this.formY;
    const ay = this.formX;
    return [this.x + ax * m.ox - this.formX * m.oy + wx, this.y + ay * m.ox - this.formY * m.oy + wy];
  }

  private updateMarch(deltaMs: number): void {
    if (this.data.type !== 'marching') return;
    if (!this.active) {
      this.waitLeft -= deltaMs;
      if (this.waitLeft <= 0) this.spawn();
      return;
    }
    const path = this.data.path;
    let step = (this.pathSpeed * deltaMs) / 1000;
    while (step > 0) {
      const goal = path[this.leg];
      const dx = goal.x - this.x;
      const dy = goal.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        this.dirX = dx / dist;
        this.dirY = dy / dist;
      }
      if (dist > step) {
        this.x += this.dirX * step;
        this.y += this.dirY * step;
        return;
      }
      this.x = goal.x;
      this.y = goal.y;
      step -= dist;
      if (this.leg === path.length - 1) {
        this.despawn(this.data.intervalMs, true);
        return;
      }
      this.leg++;
    }
  }

  /** Hide the group (fading if fade is true) and start it again after waitMs. */
  private despawn(waitMs: number, fade: boolean): void {
    this.active = false;
    this.waitLeft = waitMs;
    const targets = [this.ground, ...this.members.map((m) => m.character)];
    if (fade) this.scene.tweens.add({ targets, alpha: 0, duration: FADE_MS });
    else for (const o of targets) o.setAlpha(0);
  }

  private spawn(): void {
    if (this.data.type !== 'marching') return;
    const start = this.data.path[0];
    this.x = start.x;
    this.y = start.y;
    this.leg = 1;
    this.active = true;
    const first = this.data.path[1];
    const len = Math.hypot(first.x - start.x, first.y - start.y) || 1;
    this.dirX = this.formX = (first.x - start.x) / len;
    this.dirY = this.formY = (first.y - start.y) / len;
    for (const m of this.members) m.character.setPosition(...this.slot(m, this.time / 1000));
    this.ground.setPosition(this.x, this.y);
    const targets = [this.ground, ...this.members.map((m) => m.character)];
    this.scene.tweens.killTweensOf(targets);
    this.scene.tweens.add({ targets, alpha: { from: 0, to: 1 }, duration: FADE_MS });
  }
}
