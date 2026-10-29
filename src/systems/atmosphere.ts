import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { ResolvedLevel } from '../levels/types';
import type { Noir } from './noir';

/**
 * The light that survives the gray: lit windows, neon signs and the wet-street reflections under lamps and
 * windows, plus rain at night. Levels with "noir" only. It is drawn above the filtered world layer, so
 * gray ground still shows these lights in colour: windows and neon keep their own colours, and the
 * reflections lean cold blue on gray ground and warm gold on coloured ground. It follows the zone system:
 * the reflections are redrawn when a zone changes colour.
 */
const COLD = 0x8cc4ff;
const WARM = 0xffc86a;
const WINDOW = 0xffd88a;
const GOLD = 0xff9f2e; // the golden grade of coloured ground
const RAIN = 0xbcd6ff;
const RAIN_DROPS = 70;
const SETTLE_MS = 1600; // a won zone takes this long to finish colouring, then the reflections are redrawn once more

interface Drop {
  x: number;
  y: number;
  speed: number;
  len: number;
}

export class Atmosphere {
  private glow: Phaser.GameObjects.Graphics; // additive: halos and reflections
  private cores: Phaser.GameObjects.Graphics; // the lit windows and the neon tubes themselves
  private rain: Phaser.GameObjects.Graphics | null = null;
  private drops: Drop[] = [];
  private revision = -1;
  private settleAt = 0;
  private clock = 0;

  constructor(scene: Phaser.Scene, private level: ResolvedLevel, private noir: Noir) {
    // At night these are light sources, so they sit above the darkness (depth 35); by day just above the gray layer.
    const base = level.night ? 35.2 : 29.4;
    this.glow = scene.add.graphics().setDepth(base).setBlendMode(Phaser.BlendModes.ADD);
    this.cores = scene.add.graphics().setDepth(base + 0.05);
    if (level.night) {
      this.rain = scene.add.graphics().setScrollFactor(0).setDepth(base + 0.1);
      for (let i = 0; i < RAIN_DROPS; i++) this.drops.push(this.newDrop(true));
    }
    this.redraw();
  }

  update(deltaMs: number): void {
    this.clock += deltaMs;
    if (this.noir.revision !== this.revision) {
      this.revision = this.noir.revision;
      this.settleAt = this.clock + SETTLE_MS;
      this.redraw();
    } else if (this.settleAt > 0 && this.clock >= this.settleAt) {
      this.settleAt = 0;
      this.redraw();
    }
    if (this.rain) this.updateRain(deltaMs);
  }

  private tone(x: number, y: number): number {
    return this.noir.coloredAt(x, y) ? WARM : COLD;
  }

  /** A cheap stable 0..1 number from a few integers, so the same windows are lit on every launch. */
  private hash(a: number, b: number): number {
    let h = (a * 374761393 + b * 668265263) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  private redraw(): void {
    const glow = this.glow.clear();
    const cores = this.cores.clear();
    const mid = this.level.width / 2;

    // The golden grade: a warm additive wash over every fully coloured zone, strongest at the top of each
    // (the light comes from the low sun, ahead of Pip as he walks north).
    for (const z of this.noir.coloredZones()) {
      const bands = 10;
      for (let i = 0; i < bands; i++) {
        const y0 = Math.round(z.y + (z.height * i) / bands);
        const y1 = Math.round(z.y + (z.height * (i + 1)) / bands);
        glow.fillStyle(GOLD, 0.21 - 0.11 * (i / (bands - 1))).fillRect(z.x, y0, z.width, y1 - y0);
      }
    }

    // Lit windows along the street edge of every building, and their reflections on the wet road.
    for (const o of this.level.obstacles) {
      if (o.type !== 'building' || o.style === 'water') continue;
      const left = o.x + o.width / 2 < mid;
      const edge = left ? o.x + o.width : o.x;
      const dir = left ? 1 : -1;
      for (let y = o.y + 18; y < o.y + o.height - 14; y += 24) {
        if (this.hash(Math.round(o.x) + Math.round(y), Math.round(o.y)) < 0.34) continue;
        const wx = edge - (left ? 11 : -3);
        cores.fillStyle(WINDOW, 1).fillRect(wx, y, 8, 5);
        glow.fillStyle(WINDOW, 0.16).fillRect(wx - 3, y - 3, 14, 11);
        // The reflection: a thin streak running out across the street from the lit window.
        const len = 24 + this.hash(Math.round(y), Math.round(o.x)) * 26;
        const tone = this.tone(edge + dir * 14, y);
        glow.fillStyle(tone, 0.16).fillRect(left ? edge : edge - len, y + 0.5, len, 3.5);
        glow.fillStyle(tone, 0.08).fillRect(left ? edge : edge - len * 1.4, y - 1.5, len * 1.4, 7.5);
      }
    }

    // Neon signs: a bright tube, a soft halo and a coloured spill on the street.
    for (const n of this.level.neon ?? []) {
      const c = Phaser.Display.Color.HexStringToColor(n.color).color;
      const left = n.x + n.width / 2 < mid;
      glow.fillStyle(c, 0.07).fillRoundedRect(n.x - 22, n.y - 14, n.width + 44, n.height + 28, 18);
      glow.fillStyle(c, 0.12).fillRoundedRect(n.x - 12, n.y - 8, n.width + 24, n.height + 16, 12);
      glow.fillStyle(c, 0.2).fillRoundedRect(n.x - 5, n.y - 4, n.width + 10, n.height + 8, 7);
      // Spill on the wet road, on the street side of the sign.
      const sx = left ? n.x + n.width : n.x - 70;
      glow.fillStyle(c, 0.08).fillEllipse(sx + 35, n.y + n.height / 2, 90, n.height * 0.9);
      glow.fillStyle(c, 0.07).fillRect(sx + (left ? 0 : 0), n.y + 2, 70, 3);
      cores.fillStyle(0xffffff, 1).fillRoundedRect(n.x + n.width * 0.2, n.y + 1, n.width * 0.6, n.height - 2, 2);
      cores.lineStyle(Math.max(2, n.width * 0.34), c, 1).strokeRoundedRect(n.x + 1, n.y + 1, n.width - 2, n.height - 2, 3);
    }

    // Lamps: cold or warm halo and long vertical streaks on the wet street under each.
    for (const l of this.level.night?.lights ?? []) {
      const tone = this.tone(l.x, l.y);
      glow.fillStyle(tone, 0.05).fillCircle(l.x, l.y, l.radius * 0.95);
      glow.fillStyle(tone, 0.07).fillCircle(l.x, l.y, l.radius * 0.55);
      glow.fillStyle(0xffffff, 0.12).fillCircle(l.x, l.y, 9);
      for (let k = -2; k <= 2; k++) {
        const h = l.radius * (0.7 - Math.abs(k) * 0.12);
        glow.fillStyle(tone, 0.14 - Math.abs(k) * 0.025).fillRect(l.x + k * 6 - 1.2, l.y + 4, 2.4, h);
      }
    }
  }

  private newDrop(anywhere: boolean): Drop {
    return {
      x: Math.random() * (GAME_WIDTH + 80) - 20,
      y: anywhere ? Math.random() * GAME_HEIGHT : -20 - Math.random() * 60,
      speed: 560 + Math.random() * 280,
      len: 10 + Math.random() * 12,
    };
  }

  private updateRain(deltaMs: number): void {
    const g = this.rain!.clear();
    g.lineStyle(1.3, RAIN, 0.4);
    const dt = deltaMs / 1000;
    for (const d of this.drops) {
      d.y += d.speed * dt;
      d.x -= d.speed * 0.16 * dt;
      if (d.y > GAME_HEIGHT + 20 || d.x < -40) Object.assign(d, this.newDrop(false));
      g.lineBetween(d.x, d.y, d.x + d.len * 0.16, d.y - d.len);
    }
  }
}
