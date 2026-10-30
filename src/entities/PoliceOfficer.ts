import Phaser from 'phaser';
import {
  ALERT_LOOK_MS, ALERT_SPEED_FACTOR, CHARACTER_SCALE, CHASE_REPATH_MS, COLORS, OFFICER_TURN_SPEED, SEARCH_PAUSE_MS, SEARCH_POINTS, SEARCH_SPEED_FACTOR, SEARCH_RADIUS,
  VISION_RAYS,
} from '../config';
import type { LightData, OfficerData, Point, Rect } from '../levels/types';
import { inkify } from './ink';
import { angleDiff, castRay, hasLineOfSight } from '../systems/geometry';
import type { NavGrid } from '../systems/nav';

type State = 'patrol' | 'going' | 'looking' | 'returning' | 'chasing' | 'searchGo' | 'searching';

/**
 * A police officer walking a fixed patrol route with a vision cone. Every walk
 * to a target goes through the level's navigation grid, so officers go around
 * buildings. When called by noise (investigate), they leave the route, walk to
 * the spot, look around for ALERT_LOOK_MS and walk back. In chase levels they
 * can also chase Pip (beginChase), go to the last seen spot when the chase
 * loses him (startSearch), check a few points around it, and walk back.
 */
export class PoliceOfficer {
  /**
   * Sight rule shared by every officer, set by GameScene for each level. At
   * night (darkFactor below 1) a point outside every lit pool is only seen
   * within darkFactor of the cone's range. Being static, it also applies to
   * officers the balance tools create.
   */
  static sight: { night: boolean; lights: LightData[]; darkFactor: number } = { night: false, lights: [], darkFactor: 1 };

  /** True when (x, y) stands in a lamp's pool of light. */
  static lit(x: number, y: number): boolean {
    return PoliceOfficer.sight.lights.some((l) => Math.hypot(x - l.x, y - l.y) <= l.radius);
  }

  /** How far an officer can spot someone standing at (x, y), as a fraction of the cone's range. */
  static rangeFactorAt(x: number, y: number): number {
    const s = PoliceOfficer.sight;
    return !s.night || PoliceOfficer.lit(x, y) ? 1 : s.darkFactor;
  }

  /** Navigation grid of the level, set by GameScene. Without one, officers walk straight lines. */
  static nav: NavGrid | null = null;

  /** Chase and search values of the difficulty, set by GameScene. */
  static rules = { chaseSpeed: 160, searchMs: 8000, closeRange: 55, reactMs: 300, joinMs: 900 };

  readonly data: OfficerData;
  /** Outline of the last drawn cone (x, y pairs, starting at the officer), for the night overlay's flashlight holes. */
  beam: number[] = [];
  x: number;
  y: number;
  facing: number;

  private sprite: Phaser.GameObjects.Image;
  private cone: Phaser.GameObjects.Graphics;
  /** What the cone was last drawn for; it is only redrawn when one of these changes. */
  private coneKey = '';
  private target = 1;
  private direction = 1; // +1 forward, -1 backward (pingpong only)
  private pauseLeft = 0;
  private halfAngle: number;
  private state: State = 'patrol';
  private goalX = 0; // where the officer is walking to
  private goalY = 0;
  private homeX = 0; // where the officer left the patrol route
  private homeY = 0;
  private lookLeft = 0;
  private lookBase = 0;
  private path: Point[] = [];
  private pathGX = NaN; // the goal the current path was planned for
  private pathGY = NaN;
  private repathLeft = 0;
  private searchLeft = 0;
  private reactLeft = 0; // startled: a chasing officer stands this long before running
  private searchPoints: Point[] = [];
  private searchIndex = 0;
  private searchPause = 0;
  private rand: () => number;
  private alertMark: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: OfficerData) {
    this.data = data;
    this.x = data.patrol[0].x;
    this.y = data.patrol[0].y;
    this.halfAngle = Phaser.Math.DegToRad(data.visionAngle) / 2;
    let seed = (Math.round(data.patrol[0].x * 7 + data.patrol[0].y * 13) | 0) || 1;
    this.rand = () => {
      seed = (seed * 1664525 + 1013904223) | 0;
      return ((seed >>> 0) % 100000) / 100000;
    };
    if (data.patrol.length < 2) this.target = 0;
    const next = data.patrol[this.target];
    this.facing = next === data.patrol[0] ? -Math.PI / 2 : Math.atan2(next.y - this.y, next.x - this.x);

    this.cone = scene.add.graphics().setDepth(5);
    this.sprite = this.buildSprite(scene).setDepth(20);
    this.alertMark = scene.add
      .text(0, 0, '?', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '26px', color: '#ffd23f', stroke: '#000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(42)
      .setVisible(false);
    this.syncSprite();
  }

  /** True when off the patrol route for any reason: noise, chase, search or walking back. */
  get alerted(): boolean {
    return this.state !== 'patrol';
  }

  get chasing(): boolean {
    return this.state === 'chasing';
  }

  /** Walking to a noise (going) or looking around there. */
  get investigating(): boolean {
    return this.state === 'going' || this.state === 'looking';
  }

  /** Walking to a noise, not there yet. */
  get going(): boolean {
    return this.state === 'going';
  }

  get searching(): boolean {
    return this.state === 'searchGo' || this.state === 'searching';
  }

  /** On patrol, called by noise, or walking back: these officers fill the seen meter. */
  get watching(): boolean {
    return !this.chasing && !this.searching;
  }

  /** Length of the walk from here to (x, y) on the navigation grid, or Infinity when there is none. */
  walkDistanceTo(x: number, y: number): number {
    const nav = PoliceOfficer.nav;
    if (!nav) return Math.hypot(x - this.x, y - this.y);
    const path = nav.findPath(this.x, this.y, x, y);
    if (!path.length) return Infinity;
    let len = 0;
    let px = this.x;
    let py = this.y;
    for (const p of path) {
      len += Math.hypot(p.x - px, p.y - py);
      px = p.x;
      py = p.y;
    }
    return len;
  }

  /** Remember where the officer left the patrol route, once. */
  private leavePatrol(): void {
    if (this.state === 'patrol') {
      this.homeX = this.x;
      this.homeY = this.y;
    }
  }

  /** Walk to (x, y) and look around there. A new call while alerted moves the spot. Ignored during a chase or search. */
  investigate(x: number, y: number): void {
    if (this.chasing || this.searching) return;
    this.leavePatrol();
    this.state = 'going';
    this.setGoal(x, y);
  }

  /**
   * Start chasing: after reactMs standing startled, run after the shared target (set with chaseTo).
   * Calling it again for an officer who is already chasing does nothing but update the target.
   */
  beginChase(x: number, y: number, reactMs = 0): void {
    if (this.state === 'chasing') {
      this.setGoal(x, y);
      return;
    }
    this.leavePatrol();
    this.state = 'chasing';
    this.reactLeft = reactMs;
    this.path = [];
    this.pathGX = NaN;
    this.setGoal(x, y);
  }

  /** New target for a chasing officer: where Pip was last seen. */
  chaseTo(x: number, y: number): void {
    if (this.state === 'chasing') this.setGoal(x, y);
  }

  /**
   * The chase lost Pip: walk to the first of the given points, then check the rest in turn (and
   * round again) until the search time is up. With no points, check around (x, y).
   */
  startSearch(x: number, y: number, points: Point[] = []): void {
    if (this.state !== 'chasing') return;
    this.state = 'searchGo';
    this.searchPoints = points.length ? points : this.pickSearchPoints(x, y);
    this.setGoal(this.searchPoints[0].x, this.searchPoints[0].y);
  }

  /** Pip's last seen spot, for the searching officer. */
  private setGoal(x: number, y: number): void {
    this.goalX = x;
    this.goalY = y;
  }

  /**
   * Whether this officer notices Pip at (px, py). Searching officers only
   * notice a player who is hidden (in a crowd at its pace) or standing in the
   * dark at night within a short close range, in any direction; otherwise the
   * normal cone applies.
   */
  notices(px: number, py: number, blockers: Rect[], hidden: boolean): boolean {
    if (this.searching && (hidden || PoliceOfficer.rangeFactorAt(px, py) < 1)) {
      return Math.hypot(px - this.x, py - this.y) <= PoliceOfficer.rules.closeRange && hasLineOfSight(this.x, this.y, px, py, blockers);
    }
    return this.canSee(px, py, blockers);
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.state !== 'patrol') {
      this.updateAlert(deltaMs);
      this.syncSprite();
      return;
    }
    const patrol = this.data.patrol;
    if (patrol.length < 2) return;

    if (this.pauseLeft > 0) {
      this.pauseLeft -= deltaMs;
    } else {
      const goal = patrol[this.target];
      const dx = goal.x - this.x;
      const dy = goal.y - this.y;
      const dist = Math.hypot(dx, dy);
      const step = this.data.speed * dt;
      if (dist <= step) {
        this.x = goal.x;
        this.y = goal.y;
        this.advanceTarget();
        this.pauseLeft = this.data.pauseMs;
      } else {
        this.x += (dx / dist) * step;
        this.y += (dy / dist) * step;
      }
    }

    // Turn smoothly toward the current target, also while paused, so the
    // officer looks ahead along the next leg before walking it.
    const goal = patrol[this.target];
    if (goal.x !== this.x || goal.y !== this.y) {
      const want = Math.atan2(goal.y - this.y, goal.x - this.x);
      const diff = angleDiff(want, this.facing);
      const maxTurn = OFFICER_TURN_SPEED * dt;
      this.facing += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
    }
    this.syncSprite();
  }

  private updateAlert(deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.repathLeft -= deltaMs;
    const rules = PoliceOfficer.rules;
    switch (this.state) {
      case 'looking': {
        // Sweep the cone left and right around the direction they arrived from.
        this.lookLeft -= deltaMs;
        const t = 1 - this.lookLeft / ALERT_LOOK_MS;
        this.facing = this.lookBase + Math.sin(t * Math.PI * 3) * 1.2;
        if (this.lookLeft <= 0) this.beginReturn();
        return;
      }
      case 'going':
        if (this.walkTo(this.goalX, this.goalY, this.data.speed * ALERT_SPEED_FACTOR, dt, 1.5)) {
          this.state = 'looking';
          this.lookLeft = ALERT_LOOK_MS;
          this.lookBase = this.facing;
        }
        return;
      case 'chasing':
        if (this.reactLeft > 0) {
          // Startled: stand and turn to the target before running.
          this.reactLeft -= deltaMs;
          const diff = angleDiff(Math.atan2(this.goalY - this.y, this.goalX - this.x), this.facing);
          this.facing += Phaser.Math.Clamp(diff, -OFFICER_TURN_SPEED * 3 * dt, OFFICER_TURN_SPEED * 3 * dt);
          return;
        }
        // Run to the shared target; standing there means Pip is not in sight, and the scene will start the search.
        this.walkTo(this.goalX, this.goalY, rules.chaseSpeed, dt, 4);
        return;
      case 'searchGo':
        if (this.walkTo(this.goalX, this.goalY, rules.chaseSpeed, dt, 3)) {
          this.state = 'searching';
          this.searchLeft = rules.searchMs;
          this.searchIndex = 1;
          this.searchPause = SEARCH_PAUSE_MS;
          this.lookBase = this.facing;
        }
        return;
      case 'searching': {
        this.searchLeft -= deltaMs;
        if (this.searchLeft <= 0) {
          this.beginReturn();
          return;
        }
        if (this.searchPause > 0) {
          // Look around at the point: a slow sweep.
          this.searchPause -= deltaMs;
          const t = 1 - this.searchPause / SEARCH_PAUSE_MS;
          this.facing = this.lookBase + Math.sin(t * Math.PI * 2) * 1.1;
          return;
        }
        const p = this.searchPoints[this.searchIndex % this.searchPoints.length];
        if (this.walkTo(p.x, p.y, rules.chaseSpeed * SEARCH_SPEED_FACTOR, dt, 3)) {
          this.searchIndex++;
          this.searchPause = SEARCH_PAUSE_MS;
          this.lookBase = this.facing;
        }
        return;
      }
      case 'returning':
        if (this.walkTo(this.homeX, this.homeY, this.data.speed, dt, 1.5)) {
          this.state = 'patrol';
          this.pauseLeft = 0;
          this.path = [];
        }
        return;
      default:
        return;
    }
  }

  private beginReturn(): void {
    this.state = 'returning';
    this.setGoal(this.homeX, this.homeY);
    this.path = [];
    this.pathGX = NaN;
  }

  /** A few free points around (cx, cy), at random distances, that can be walked to. */
  private pickSearchPoints(cx: number, cy: number): Point[] {
    const nav = PoliceOfficer.nav;
    const pts: Point[] = [];
    // Spread the points around the circle so they do not all lie one way.
    const base = this.rand() * Math.PI * 2;
    for (let k = 0; k < SEARCH_POINTS; k++) {
      for (let tries = 0; tries < 24; tries++) {
        const a = base + (k / SEARCH_POINTS) * Math.PI * 2 + (this.rand() - 0.5) * 1.2;
        const r = SEARCH_RADIUS[0] + this.rand() * (SEARCH_RADIUS[1] - SEARCH_RADIUS[0]);
        const p = { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
        if (!nav || (nav.isFree(p.x, p.y) && nav.findPath(cx, cy, p.x, p.y).length > 0)) {
          pts.push(p);
          break;
        }
      }
    }
    return pts.length ? pts : [{ x: cx, y: cy }];
  }

  /**
   * Walk toward (gx, gy) along a route planned on the navigation grid, at
   * speed, turning toward the direction of travel. The route is re-planned
   * when the goal moves (at most every CHASE_REPATH_MS). Returns true on
   * arrival, and also when no route exists, so officers never get stuck.
   */
  private walkTo(gx: number, gy: number, speed: number, dt: number, turnMul: number): boolean {
    const nav = PoliceOfficer.nav;
    const distGoal = Math.hypot(gx - this.x, gy - this.y);
    if (distGoal < 3) return true;
    let tx = gx;
    let ty = gy;
    if (nav) {
      const goalMoved = Math.hypot(gx - this.pathGX, gy - this.pathGY) > 8;
      if (Number.isNaN(this.pathGX) || (goalMoved && this.repathLeft <= 0) || (this.path.length === 0 && distGoal >= 36)) {
        this.path = nav.findPath(this.x, this.y, gx, gy);
        this.pathGX = gx;
        this.pathGY = gy;
        this.repathLeft = CHASE_REPATH_MS;
        if (this.path.length === 0 && distGoal >= 36) return true; // unreachable
      }
      while (this.path.length && Math.hypot(this.path[0].x - this.x, this.path[0].y - this.y) < 2) this.path.shift();
      if (this.path.length) {
        tx = this.path[0].x;
        ty = this.path[0].y;
      }
    }
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    const step = speed * dt;
    const diff = angleDiff(Math.atan2(dy, dx), this.facing);
    this.facing += Phaser.Math.Clamp(diff, -OFFICER_TURN_SPEED * turnMul * dt, OFFICER_TURN_SPEED * turnMul * dt);
    if (dist <= step) {
      this.x = tx;
      this.y = ty;
      if (this.path.length) this.path.shift();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
    return Math.hypot(gx - this.x, gy - this.y) < 3;
  }

  /** True when the point is inside the vision cone and nothing blocks the view. */
  canSee(px: number, py: number, blockers: Rect[]): boolean {
    const dx = px - this.x;
    const dy = py - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > this.data.visionRange * PoliceOfficer.rangeFactorAt(px, py)) return false;
    if (Math.abs(angleDiff(Math.atan2(dy, dx), this.facing)) > this.halfAngle) return false;
    return hasLineOfSight(this.x, this.y, px, py, blockers);
  }

  /** Draw the cone clipped by obstacles. alert (0..1) tints it toward red. */
  drawCone(blockers: Rect[], alert: number): void {
    const key = `${this.x.toFixed(2)}|${this.y.toFixed(2)}|${this.facing.toFixed(4)}|${alert.toFixed(2)}|${PoliceOfficer.sight.night ? 1 : 0}`;
    if (key === this.coneKey) return;
    this.coneKey = key;
    const g = this.cone;
    g.clear();
    const color = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(COLORS.cone),
      Phaser.Display.Color.ValueToColor(COLORS.coneAlert),
      100,
      Math.round(alert * 100),
    );
    const fill = Phaser.Display.Color.GetColor(color.r, color.g, color.b);
    const start = this.facing - this.halfAngle;
    const step = (this.halfAngle * 2) / VISION_RAYS;
    const sight = PoliceOfficer.sight;
    // Ray distances once; the night beam reuses them for its brighter inner part.
    const rays: [number, number, number][] = [];
    for (let i = 0; i <= VISION_RAYS; i++) {
      const a = start + step * i;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      rays.push([dx, dy, castRay(this.x, this.y, dx, dy, this.data.visionRange, blockers)]);
    }
    this.beam = [this.x, this.y];
    for (const [dx, dy, d] of rays) this.beam.push(this.x + dx * d, this.y + dy * d);
    const polygon = (reach: number, alpha: number) => {
      g.fillStyle(fill, alpha);
      g.beginPath();
      g.moveTo(this.x, this.y);
      for (const [dx, dy, d] of rays) {
        const r = Math.min(d, reach);
        g.lineTo(this.x + dx * r, this.y + dy * r);
      }
      g.closePath();
      g.fillPath();
    };
    if (!sight.night) {
      polygon(Infinity, 0.28 + alert * 0.2);
      return;
    }
    // A flashlight: the whole beam is where a lit player is spotted, the bright
    // inner part where a player in the dark is spotted.
    polygon(Infinity, 0.16 + alert * 0.15);
    polygon(this.data.visionRange * sight.darkFactor, 0.3 + alert * 0.2);
  }

  private advanceTarget(): void {
    const last = this.data.patrol.length - 1;
    if (this.data.mode === 'loop') {
      this.target = (this.target + 1) % (last + 1);
      return;
    }
    if (this.target + this.direction > last || this.target + this.direction < 0) this.direction *= -1;
    this.target += this.direction;
  }

  /** The officer is drawn once into a texture shared by every officer, then shown as an image. */
  private buildSprite(scene: Phaser.Scene): Phaser.GameObjects.Image {
    const key = 'officer-sprite';
    const res = 2; // baked at twice the size for sharpness
    if (!scene.textures.exists(key)) {
      const g = inkify(scene.make.graphics({}, false), 1.25);
      // Drawn facing up, like the player: inked, with a big cap over a big head.
      g.fillStyle(0xf3cfa4, 1);
      g.fillCircle(-15, 2, 5);
      g.fillCircle(15, 2, 5);
      g.fillStyle(COLORS.officer, 1);
      g.fillEllipse(0, 2, 32, 19);
      g.fillStyle(0xf2c94c, 1);
      g.fillRect(-11, -1, 4, 3); // badge
      g.fillStyle(COLORS.officerCap, 1);
      g.fillCircle(0, 0, 11);
      g.fillStyle(0x0b1326, 1);
      g.fillEllipse(0, -9.5, 15, 7); // cap peak
      g.fillStyle(0xffffff, 1);
      g.fillRect(-2, -3, 4, 3);
      g.setScale(res);
      const dt = scene.textures.addDynamicTexture(key, 64 * res, 64 * res)!;
      dt.draw(g, 32 * res, 32 * res).render();
      g.destroy();
    }
    return scene.add.image(this.x, this.y, key).setScale(CHARACTER_SCALE / res);
  }

  private syncSprite(): void {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.rotation = this.facing + Math.PI / 2;
    const chase = this.state === 'chasing';
    const question = this.state === 'going' || this.state === 'looking' || this.searching;
    this.alertMark
      .setText(chase ? '!' : '?')
      .setColor(chase ? '#ff4a4a' : '#ffd23f')
      .setFontSize(chase ? 32 : 26)
      .setVisible(chase || question)
      .setPosition(this.x, this.y - 34);
  }
}
