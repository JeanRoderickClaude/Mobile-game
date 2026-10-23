import type { Rect } from '../levels/types';

/**
 * Distance along a ray (origin + t * dir) to the first hit with a rectangle,
 * using the slab method. Returns null when the ray misses or the hit lies
 * beyond maxT. A ray that starts inside the rectangle hits at t = 0.
 */
export function rayRect(ox: number, oy: number, dx: number, dy: number, r: Rect, maxT: number): number | null {
  let tMin = 0;
  let tMax = maxT;

  if (Math.abs(dx) < 1e-9) {
    if (ox < r.x || ox > r.x + r.width) return null;
  } else {
    let t1 = (r.x - ox) / dx;
    let t2 = (r.x + r.width - ox) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  if (Math.abs(dy) < 1e-9) {
    if (oy < r.y || oy > r.y + r.height) return null;
  } else {
    let t1 = (r.y - oy) / dy;
    let t2 = (r.y + r.height - oy) / dy;
    if (t1 > t2) [t1, t2] = [t2, t1];
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return null;
  }

  return tMin;
}

/** Distance from the origin to the nearest blocker along a unit direction, capped at range. */
export function castRay(ox: number, oy: number, dx: number, dy: number, range: number, blockers: Rect[]): number {
  let nearest = range;
  for (const r of blockers) {
    const t = rayRect(ox, oy, dx, dy, r, nearest);
    if (t !== null && t < nearest) nearest = t;
  }
  return nearest;
}

/** True when the straight segment between two points crosses no blocker. */
export function hasLineOfSight(ax: number, ay: number, bx: number, by: number, blockers: Rect[]): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  for (const r of blockers) {
    if (rayRect(ax, ay, dx, dy, r, 1) !== null) return false;
  }
  return true;
}

/** Smallest signed difference between two angles, in the range -PI..PI. */
export function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when a square of half-size `half` centred on (x, y) overlaps a rectangle. */
export function overlaps(x: number, y: number, half: number, r: Rect): boolean {
  return x + half > r.x && x - half < r.x + r.width && y + half > r.y && y - half < r.y + r.height;
}
