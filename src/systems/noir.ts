import Phaser from 'phaser';
import {
  GAME_HEIGHT, GAME_WIDTH, NOIR_AURA_GROW_MS, NOIR_AURA_FACTOR, NOIR_AURA_FADE_MS, NOIR_CONTRAST, NOIR_SPREAD_MS } from '../config';
import type { NoirZone, Rect } from '../levels/types';

const MASK_SCALE = 0.5; // mask texture resolution relative to the screen

interface Zone extends NoirZone {
  colored: boolean;
  /** Music still needed to win the zone, in ms. Infinity when it cannot be won. */
  left: number;
  /** Set while a won zone fills with colour: where it started and how far along it is. */
  spreadX: number;
  spreadY: number;
  spread: number;
}

/**
 * The gray, high-contrast look for controlled ground. Every world object
 * except Pip and the HUD sits in one Layer. A ParallelFilters filter on it
 * draws a grayscale copy underneath and the original colours on top, cut out
 * by a mask of everything that is coloured: zones that start coloured, zones
 * won with music, and the glow that spreads from Pip while he plays. The
 * mask only ever adds shapes, so it is cheap to redraw each frame.
 */
export class Noir {
  readonly layer: Phaser.GameObjects.Layer;
  private zones: Zone[];
  private mask: Phaser.GameObjects.Graphics;
  private aura = 0; // 0..1, the colour glow around Pip
  private enabled: boolean;
  private mixed: Phaser.Filters.ParallelFilters | null = null; // gray and colour on screen together
  private grayOnly: Phaser.Filters.ColorMatrix | null = null; // the whole screen is gray
  /** What the last frame needed: one of the three filter setups. */
  mode: 'gray' | 'mixed' | 'color' = 'gray';

  constructor(scene: Phaser.Scene, zones: NoirZone[]) {
    this.layer = scene.add.layer();
    this.zones = zones.map((z) => ({
      ...z,
      colored: z.start === 'color',
      left: z.musicMs !== undefined ? z.musicMs : Infinity,
      spreadX: 0,
      spreadY: 0,
      spread: 1,
    }));
    this.mask = scene.make.graphics({}, false);
    // Filters need WebGL; on the canvas renderer the level simply stays in colour.
    this.enabled = scene.game.renderer.type === Phaser.WEBGL;
    if (this.enabled) {
      // Three setups, picked each frame by what is on screen: the mask-and-blend
      // chain only when gray and colour meet, one colour-matrix pass when the
      // view is all gray, and no filter when it is all colour.
      this.layer.enableFilters();
      this.mixed = this.layer.filters!.internal.addParallelFilters();
      this.mixed.bottom.addColorMatrix().colorMatrix.set(noirMatrix(1));
      // The mask is drawn at half resolution (its edges are soft anyway), in
      // screen space through a fixed camera: update() moves and scales the
      // Graphics so world coordinates land on the half-size mask texture.
      const maskCam = new Phaser.Cameras.Scene2D.Camera(0, 0, GAME_WIDTH, GAME_HEIGHT).setScene(scene, false);
      this.mixed.top.addMask(this.mask, false, maskCam, 'local', MASK_SCALE);
      this.grayOnly = this.layer.filters!.internal.addColorMatrix();
      this.grayOnly.colorMatrix.set(noirMatrix(1));
    }
  }

  /** Moves objects into the filtered layer, keeping their depth order. */
  adopt(objects: Phaser.GameObjects.GameObject[]): void {
    for (const o of objects) this.layer.add(o);
  }

  /** Turns a rectangle coloured for the rest of the run, filling outward from (fromX, fromY). */
  colorArea(rect: Rect, fromX: number, fromY: number): void {
    this.zones.push({ ...rect, start: 'gray', colored: true, left: Infinity, spreadX: fromX, spreadY: fromY, spread: 0 });
  }

  /** The zone Pip is in that music can still win, with how much is done (0..1), or null. */
  progressAt(x: number, y: number): number | null {
    const z = this.zones.find((zone) => !zone.colored && zone.left !== Infinity && inside(zone, x, y));
    return z ? 1 - z.left / z.musicMs! : null;
  }

  /** True when the point is coloured permanently (a coloured or won zone). */
  coloredAt(x: number, y: number): boolean {
    return this.zones.some((z) => z.colored && z.spread >= 1 && inside(z, x, y));
  }

  update(
    deltaMs: number, view: Phaser.Geom.Rectangle, pipX: number, pipY: number, playing: boolean, hearing: number,
    rings: { x: number; y: number; age: number }[], ringLife: number,
  ): void {
    this.aura = Phaser.Math.Clamp(this.aura + deltaMs / (playing ? NOIR_AURA_GROW_MS : -NOIR_AURA_FADE_MS), 0, 1);
    for (const z of this.zones) {
      if (z.colored) {
        z.spread = Math.min(1, z.spread + deltaMs / NOIR_SPREAD_MS);
        continue;
      }
      if (playing && inside(z, pipX, pipY) && (z.left -= deltaMs) <= 0) {
        z.colored = true;
        z.spread = 0;
        z.spreadX = pipX;
        z.spreadY = pipY;
      }
    }
    if (!this.enabled) return;

    this.mode = this.pickMode(view, rings.length > 0);
    this.mixed!.setActive(this.mode === 'mixed');
    this.grayOnly!.setActive(this.mode === 'gray');
    this.layer.renderFilters = this.mode !== 'color';
    if (this.mode !== 'mixed') return;

    const g = this.mask.clear().setScale(MASK_SCALE).setPosition(-view.x * MASK_SCALE, -view.y * MASK_SCALE);
    g.fillStyle(0xffffff, 1);
    for (const z of this.zones) {
      if (!z.colored) continue;
      if (z.spread >= 1) g.fillRect(z.x, z.y, z.width, z.height);
      else fillCircleInRect(g, z.spreadX, z.spreadY, Math.hypot(z.width, z.height) * easeOut(z.spread), z);
    }
    // The glow around Pip, soft at the edge, and a fading disc behind every sound ring.
    if (this.aura > 0) softCircle(g, pipX, pipY, hearing * NOIR_AURA_FACTOR * easeOut(this.aura), 1);
    for (const r of rings) {
      const t = r.age / ringLife;
      softCircle(g, r.x, r.y, 20 + (hearing - 20) * t, 0.55 * (1 - t));
    }
  }

  /** "color" when a finished coloured zone covers the view, "mixed" when any colour shows, else "gray". */
  private pickMode(view: Phaser.Geom.Rectangle, ringsOut: boolean): 'gray' | 'mixed' | 'color' {
    const vx2 = view.x + view.width;
    const vy2 = view.y + view.height;
    // Pip is always on screen, so his glow and rings always show.
    let colour = this.aura > 0 || ringsOut;
    for (const z of this.zones) {
      if (!z.colored) continue;
      if (z.spread >= 1 && z.x <= view.x && z.y <= view.y && z.x + z.width >= vx2 && z.y + z.height >= vy2) return 'color';
      if (z.x < vx2 && z.x + z.width > view.x && z.y < vy2 && z.y + z.height > view.y) colour = true;
    }
    return colour ? 'mixed' : 'gray';
  }
}

/**
 * Colour matrix for the noir look, t from 0 (untouched) to 1 (full gray with
 * NOIR_CONTRAST added contrast around mid-gray). Built by hand: Phaser's
 * ColorMatrix reads offsets in 0..255 units, but its contrast() writes them
 * in 0..1, so its contrast only brightens.
 */
export function noirMatrix(t: number): number[] {
  const v = 1 + NOIR_CONTRAST;
  const g = v / 3; // equal-weight gray, scaled for contrast
  const o = -0.5 * NOIR_CONTRAST * 255; // keeps mid-gray in place (offsets are in 0..255)
  const gray = [g, g, g, 0, o, g, g, g, 0, o, g, g, g, 0, o, 0, 0, 0, 1, 0];
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  return identity.map((a, i) => a + (gray[i] - a) * t);
}


function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** A filled circle with a soft edge: three rings of falling alpha outside the core. */
function softCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha: number): void {
  if (r <= 0 || alpha <= 0) return;
  g.fillStyle(0xffffff, alpha * 0.35).fillCircle(x, y, r);
  g.fillStyle(0xffffff, alpha * 0.35).fillCircle(x, y, r * 0.88);
  g.fillStyle(0xffffff, alpha * 0.5).fillCircle(x, y, r * 0.75);
}

/** A circle clipped to a rectangle, as a polygon with its points clamped into the rectangle. */
function fillCircleInRect(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, rect: Rect): void {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    pts.push(new Phaser.Math.Vector2(
      Phaser.Math.Clamp(x + Math.cos(a) * r, rect.x, rect.x + rect.width),
      Phaser.Math.Clamp(y + Math.sin(a) * r, rect.y, rect.y + rect.height),
    ));
  }
  g.fillPoints(pts, true);
}
