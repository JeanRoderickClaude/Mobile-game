import type { Point, Rect } from '../levels/types';
import { hasLineOfSight } from './geometry';

/** Grid cell size in level units. Corridors must be wider than one cell plus the officer margin. */
export const NAV_CELL = 20;
/** Officers keep this far from obstacles (their half-size plus a little). A grid can be built with another margin. */
export const NAV_MARGIN = 14;

/**
 * A navigation grid generated from a level's obstacles: a cell is blocked when
 * its square touches an obstacle grown by NAV_MARGIN. findPath runs A* over
 * eight-way moves (no cutting corners) and then pulls the path straight
 * wherever the grown obstacles leave a clear line, so officers walk around
 * buildings in a few long legs instead of a staircase.
 */
export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  private blocked: Uint8Array;
  /** Obstacles grown by the margin, for the straight-line checks. */
  readonly grown: Rect[];

  constructor(readonly width: number, readonly height: number, obstacles: Rect[], readonly margin = NAV_MARGIN) {
    this.cols = Math.ceil(width / NAV_CELL);
    this.rows = Math.ceil(height / NAV_CELL);
    this.grown = obstacles.map((o) => ({ x: o.x - margin, y: o.y - margin, width: o.width + margin * 2, height: o.height + margin * 2 }));
    this.blocked = new Uint8Array(this.cols * this.rows);
    for (const r of this.grown) {
      const c0 = Math.max(0, Math.floor(r.x / NAV_CELL));
      const c1 = Math.min(this.cols - 1, Math.floor((r.x + r.width) / NAV_CELL));
      const r0 = Math.max(0, Math.floor(r.y / NAV_CELL));
      const r1 = Math.min(this.rows - 1, Math.floor((r.y + r.height) / NAV_CELL));
      for (let j = r0; j <= r1; j++) for (let i = c0; i <= c1; i++) this.blocked[j * this.cols + i] = 1;
    }
    // Keep the cells along the level edge free of the margin: only blocked by real obstacles.
  }

  private cell(x: number, y: number): number {
    const i = Math.min(this.cols - 1, Math.max(0, Math.floor(x / NAV_CELL)));
    const j = Math.min(this.rows - 1, Math.max(0, Math.floor(y / NAV_CELL)));
    return j * this.cols + i;
  }

  private centre(c: number): Point {
    return { x: (c % this.cols) * NAV_CELL + NAV_CELL / 2, y: Math.floor(c / this.cols) * NAV_CELL + NAV_CELL / 2 };
  }

  /** True when a point stands where an officer may walk. */
  isFree(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x <= this.width && y <= this.height && !this.blocked[this.cell(x, y)];
  }

  /** The free cell nearest to (x, y), searched in rings. */
  private nearestFree(x: number, y: number): number {
    const start = this.cell(x, y);
    if (!this.blocked[start]) return start;
    const ci = start % this.cols;
    const cj = Math.floor(start / this.cols);
    for (let ring = 1; ring < 12; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let j = cj - ring; j <= cj + ring; j++) {
        for (let i = ci - ring; i <= ci + ring; i++) {
          if (Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== ring) continue;
          if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
          const c = j * this.cols + i;
          if (this.blocked[c]) continue;
          const p = this.centre(c);
          const d = Math.hypot(p.x - x, p.y - y);
          if (d < bestD) { bestD = d; best = c; }
        }
      }
      if (best >= 0) return best;
    }
    return start;
  }

  /** A clear straight walk between two points. */
  clear(ax: number, ay: number, bx: number, by: number): boolean {
    return hasLineOfSight(ax, ay, bx, by, this.grown);
  }

  /**
   * Waypoints from (sx, sy) to (gx, gy), not including the start. A goal in a
   * blocked cell is moved to the nearest free cell. Returns an empty list when
   * the goal cannot be reached.
   */
  findPath(sx: number, sy: number, gx: number, gy: number): Point[] {
    if (this.clear(sx, sy, gx, gy) && this.isFree(gx, gy)) return [{ x: gx, y: gy }];
    const s = this.nearestFree(sx, sy);
    const g = this.nearestFree(gx, gy);
    const goalPoint = this.isFree(gx, gy) ? { x: gx, y: gy } : this.centre(g);
    const cells = this.astar(s, g);
    if (!cells) return [];
    // Pull the path straight: from each anchor, jump to the furthest cell centre in clear view.
    const pts: Point[] = [{ x: sx, y: sy }, ...cells.slice(1, -1).map((c) => this.centre(c)), goalPoint];
    const out: Point[] = [];
    let anchor = 0;
    while (anchor < pts.length - 1) {
      let next = anchor + 1;
      for (let k = pts.length - 1; k > anchor + 1; k--) {
        if (this.clear(pts[anchor].x, pts[anchor].y, pts[k].x, pts[k].y)) { next = k; break; }
      }
      out.push(pts[next]);
      anchor = next;
    }
    return out;
  }

  private astar(start: number, goal: number): number[] | null {
    if (start === goal) return [start, goal];
    const n = this.cols * this.rows;
    const gScore = new Float32Array(n).fill(Infinity);
    const from = new Int32Array(n).fill(-1);
    const closed = new Uint8Array(n);
    const heap = new MinHeap();
    const gi = goal % this.cols;
    const gj = Math.floor(goal / this.cols);
    const h = (c: number) => {
      const dx = Math.abs((c % this.cols) - gi);
      const dy = Math.abs(Math.floor(c / this.cols) - gj);
      return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * NAV_CELL; // octile distance
    };
    gScore[start] = 0;
    heap.push(start, h(start));
    while (heap.size) {
      const c = heap.pop();
      if (closed[c]) continue;
      closed[c] = 1;
      if (c === goal) {
        const path: number[] = [];
        for (let k = c; k !== -1; k = from[k]) path.push(k);
        return path.reverse();
      }
      const ci = c % this.cols;
      const cj = Math.floor(c / this.cols);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const i = ci + di;
          const j = cj + dj;
          if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) continue;
          const nc = j * this.cols + i;
          if (this.blocked[nc] || closed[nc]) continue;
          // No cutting corners between two blocked neighbours.
          if (di && dj && (this.blocked[cj * this.cols + i] || this.blocked[j * this.cols + ci])) continue;
          const g = gScore[c] + (di && dj ? Math.SQRT2 : 1) * NAV_CELL;
          if (g < gScore[nc]) {
            gScore[nc] = g;
            from[nc] = c;
            heap.push(nc, g + h(nc));
          }
        }
      }
    }
    return null;
  }
}

/** A small binary min-heap of (item, priority). */
class MinHeap {
  private items: number[] = [];
  private prios: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, prio: number): void {
    let i = this.items.length;
    this.items.push(item);
    this.prios.push(prio);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.prios[p] <= this.prios[i]) break;
      this.swap(i, p);
      i = p;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop()!;
    const lastPrio = this.prios.pop()!;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.prios[0] = lastPrio;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < this.items.length && this.prios[l] < this.prios[m]) m = l;
        if (r < this.items.length && this.prios[r] < this.prios[m]) m = r;
        if (m === i) break;
        this.swap(i, m);
        i = m;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
    [this.prios[a], this.prios[b]] = [this.prios[b], this.prios[a]];
  }
}
