import Phaser from 'phaser';
import { ALERT_LOOK_MS, ALERT_SPEED_FACTOR, CHARACTER_SCALE, COLORS, OFFICER_TURN_SPEED, VISION_RAYS } from '../config';
import type { LightData, OfficerData, Rect } from '../levels/types';
import { angleDiff, castRay, hasLineOfSight } from '../systems/geometry';

/**
 * A police officer walking a fixed patrol route with a vision cone. When
 * called by noise (investigate), they leave the route, walk to the spot,
 * look around for ALERT_LOOK_MS and walk back to where they left it.
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

  readonly data: OfficerData;
  /** Outline of the last drawn cone (x, y pairs, starting at the officer), for the night overlay's flashlight holes. */
  beam: number[] = [];
  x: number;
  y: number;
  facing: number;

  private sprite: Phaser.GameObjects.Container;
  private cone: Phaser.GameObjects.Graphics;
  private target = 1;
  private direction = 1; // +1 forward, -1 backward (pingpong only)
  private pauseLeft = 0;
  private halfAngle: number;
  private alert: 'none' | 'going' | 'looking' | 'returning' = 'none';
  private alertX = 0;
  private alertY = 0;
  private homeX = 0; // where the officer left the patrol route
  private homeY = 0;
  private lookLeft = 0;
  private lookBase = 0;
  private alertMark: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, data: OfficerData) {
    this.data = data;
    this.x = data.patrol[0].x;
    this.y = data.patrol[0].y;
    this.halfAngle = Phaser.Math.DegToRad(data.visionAngle) / 2;
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

  /** True while walking to a noise, looking around, or walking back. */
  get alerted(): boolean {
    return this.alert !== 'none';
  }

  /** Walk to (x, y) and look around there. A new call while alerted moves the spot. */
  investigate(x: number, y: number): void {
    if (this.alert === 'none') {
      this.homeX = this.x;
      this.homeY = this.y;
    }
    this.alert = 'going';
    this.alertX = x;
    this.alertY = y;
  }

  update(deltaMs: number): void {
    const dt = deltaMs / 1000;
    if (this.alert !== 'none') {
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
    if (this.alert === 'looking') {
      // Sweep the cone left and right around the direction they arrived from.
      this.lookLeft -= deltaMs;
      const t = 1 - this.lookLeft / ALERT_LOOK_MS;
      this.facing = this.lookBase + Math.sin(t * Math.PI * 3) * 1.2;
      if (this.lookLeft <= 0) this.alert = 'returning';
      return;
    }
    const going = this.alert === 'going';
    const gx = going ? this.alertX : this.homeX;
    const gy = going ? this.alertY : this.homeY;
    const dx = gx - this.x;
    const dy = gy - this.y;
    const dist = Math.hypot(dx, dy);
    const step = this.data.speed * (going ? ALERT_SPEED_FACTOR : 1) * dt;
    if (dist > 0) {
      const diff = angleDiff(Math.atan2(dy, dx), this.facing);
      const maxTurn = OFFICER_TURN_SPEED * 1.5 * dt;
      this.facing += Phaser.Math.Clamp(diff, -maxTurn, maxTurn);
    }
    if (dist > step) {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      return;
    }
    this.x = gx;
    this.y = gy;
    if (going) {
      this.alert = 'looking';
      this.lookLeft = ALERT_LOOK_MS;
      this.lookBase = this.facing;
    } else {
      this.alert = 'none';
      this.pauseLeft = 0;
    }
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

  private buildSprite(scene: Phaser.Scene): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    // Drawn facing up, like the player.
    g.fillStyle(0xf3cfa4, 1);
    g.fillCircle(-15, 2, 4.5);
    g.fillCircle(15, 2, 4.5);
    g.fillStyle(COLORS.officer, 1);
    g.fillEllipse(0, 2, 32, 19);
    g.lineStyle(2, 0x0f1a33, 1);
    g.strokeEllipse(0, 2, 32, 19);
    g.fillStyle(0xf2c94c, 1);
    g.fillRect(-11, -1, 4, 3); // badge
    g.fillStyle(COLORS.officerCap, 1);
    g.fillCircle(0, 0, 9);
    g.fillStyle(0x0b1326, 1);
    g.fillEllipse(0, -8, 13, 6); // cap peak
    g.fillStyle(0xffffff, 1);
    g.fillRect(-2, -3, 4, 3);
    return scene.add.container(this.x, this.y, [g]).setScale(CHARACTER_SCALE);
  }

  private syncSprite(): void {
    this.sprite.setPosition(this.x, this.y);
    this.sprite.rotation = this.facing + Math.PI / 2;
    this.alertMark.setVisible(this.alert === 'going' || this.alert === 'looking').setPosition(this.x, this.y - 34);
  }
}
