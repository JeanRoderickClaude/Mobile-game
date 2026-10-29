import Phaser from 'phaser';
import {
  GAME_HEIGHT, GAME_WIDTH, NOIR_AURA_GROW_MS, NOIR_AURA_FACTOR, NOIR_AURA_FADE_MS, NOIR_CONTRAST, NOIR_SPREAD_MS } from '../config';
import type { LightData, NoirZone, Rect } from '../levels/types';
import { addGradeFilter, MAX_LAMPS, MAX_RINGS, MAX_ZONES, type GradeState } from './gradeFilter';
import type { PoliceOfficer } from '../entities/PoliceOfficer';

interface Zone extends NoirZone {
  colored: boolean;
  /** Music still needed to win the zone, in ms. Infinity when it cannot be won. */
  left: number;
  /** Set while a won zone fills with colour: where it started and how far along it is. */
  spreadX: number;
  spreadY: number;
  spread: number;
}

const BEAM_SCALE = 0.5; // the flashlight beam texture is half the screen size; the beams are soft anyway

/** Night settings handed to the grade: the lamps, how dark, and Pip's light radius. */
export interface NightSetup {
  lamps: LightData[];
  darkness: number;
  pipRadius: number;
}

/**
 * The gray, high-contrast look for controlled ground, and the night
 * darkness. Every world object except Pip and the HUD sits in one Layer with
 * a single filter pass (`gradeFilter.ts`): it grays the layer, lets colour
 * through inside coloured zones, Pip's glow and the sound rings, and darkens
 * the night. Everything it needs is a few uniforms (zone rectangles, circles)
 * plus one small texture for the flashlight beams, so no mask or darkness
 * texture is redrawn every frame.
 */
export class Noir {
  readonly layer: Phaser.GameObjects.Layer;
  private zones: Zone[];
  private aura = 0; // 0..1, the colour glow around Pip
  private enabled: boolean;
  private state: GradeState | null = null;
  private beamTex: Phaser.Textures.DynamicTexture | null = null;
  private beamGfx: Phaser.GameObjects.Graphics | null = null;
  /** Counts zones that have turned colour, so the atmosphere (reflections, windows) redraws when the ground changes. */
  revision = 0;
  /** What the last frame needed: gray only, gray and colour together, or colour only. */
  mode: 'gray' | 'mixed' | 'color' = 'gray';

  constructor(scene: Phaser.Scene, zones: NoirZone[], private night: NightSetup | null = null, private gray = true) {
    this.layer = scene.add.layer();
    this.zones = zones.map((z) => ({
      ...z,
      colored: z.start === 'color',
      left: z.musicMs !== undefined ? z.musicMs : Infinity,
      spreadX: 0,
      spreadY: 0,
      spread: 1,
    }));
    // Filters need WebGL; on the canvas renderer the level simply stays in colour and unlit.
    this.enabled = scene.game.renderer.type === Phaser.WEBGL;
    if (!this.enabled) return;
    const KEY = 'night-beams';
    if (scene.textures.exists(KEY)) scene.textures.remove(KEY);
    this.beamTex = scene.textures.addDynamicTexture(KEY, GAME_WIDTH * BEAM_SCALE, GAME_HEIGHT * BEAM_SCALE)!;
    this.beamTex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.beamGfx = scene.make.graphics({}, false);
    this.state = {
      gray: this.gray,
      cover: false,
      zoneN: 0,
      rect: new Float32Array(MAX_ZONES * 4),
      circ: new Float32Array(MAX_ZONES * 4),
      aura: [0, 0, 0, 0],
      ringN: 0,
      ring: new Float32Array(MAX_RINGS * 4),
      dark: 0,
      pip: [0, 0, 0, 0],
      lampN: 0,
      lamp: new Float32Array(MAX_LAMPS * 4),
      beam: this.beamTex,
    };
    this.layer.enableFilters();
    addGradeFilter(this.layer, this.state, FLIP_Y);
  }

  /** Moves objects into the filtered layer, keeping their depth order. */
  adopt(objects: Phaser.GameObjects.GameObject[]): void {
    for (const o of objects) this.layer.add(o);
  }

  /** Turns a rectangle coloured for the rest of the run, filling outward from (fromX, fromY). */
  colorArea(rect: Rect, fromX: number, fromY: number): void {
    this.zones.push({ ...rect, start: 'gray', colored: true, left: Infinity, spreadX: fromX, spreadY: fromY, spread: 0 });
    this.revision++;
  }

  /** The zone Pip is in that music can still win, with how much is done (0..1), or null. */
  progressAt(x: number, y: number): number | null {
    const z = this.zones.find((zone) => !zone.colored && zone.left !== Infinity && inside(zone, x, y));
    return z ? 1 - z.left / z.musicMs! : null;
  }

  /** The zones that are fully coloured now (won, or coloured from the start), for the golden grade drawn over them. */
  coloredZones(): Rect[] {
    return this.zones.filter((z) => z.colored && z.spread >= 1);
  }

  /** True when the point is coloured permanently (a coloured or won zone). */
  coloredAt(x: number, y: number): boolean {
    return this.zones.some((z) => z.colored && z.spread >= 1 && inside(z, x, y));
  }

  update(
    deltaMs: number, view: Phaser.Geom.Rectangle, pipX: number, pipY: number, playing: boolean, hearing: number,
    rings: { x: number; y: number; age: number }[], ringLife: number, officers: PoliceOfficer[] = [],
  ): void {
    this.aura = Phaser.Math.Clamp(this.aura + deltaMs / (playing ? NOIR_AURA_GROW_MS : -NOIR_AURA_FADE_MS), 0, 1);
    for (const z of this.zones) {
      if (z.colored) {
        z.spread = Math.min(1, z.spread + deltaMs / NOIR_SPREAD_MS);
        continue;
      }
      if (playing && inside(z, pipX, pipY) && (z.left -= deltaMs) <= 0) {
        z.colored = true;
        this.revision++;
        z.spread = 0;
        z.spreadX = pipX;
        z.spreadY = pipY;
      }
    }
    const st = this.state;
    if (!st) return;

    this.mode = this.gray ? this.pickMode(view, rings.length > 0) : 'color';
    st.gray = this.gray && this.mode !== 'color';
    // Nothing to do when the view is plain colour and there is no night.
    this.layer.renderFilters = st.gray || this.night !== null;
    if (!this.layer.renderFilters) return;

    // Zones on screen, as screen-space rectangles with the circle they are still filling from.
    let n = 0;
    for (const z of this.zones) {
      if (!z.colored || n >= MAX_ZONES) continue;
      if (z.x > view.x + GAME_WIDTH || z.x + z.width < view.x || z.y > view.y + GAME_HEIGHT || z.y + z.height < view.y) continue;
      st.rect.set([z.x - view.x, z.y - view.y, z.width, z.height], n * 4);
      const r = z.spread >= 1 ? -1 : Math.hypot(z.width, z.height) * easeOut(z.spread);
      st.circ.set([z.spreadX - view.x, z.spreadY - view.y, r, 0], n * 4);
      n++;
    }
    st.zoneN = n;
    // The glow around Pip and a fading disc behind every sound ring.
    const ar = this.aura > 0 ? hearing * NOIR_AURA_FACTOR * easeOut(this.aura) : 0;
    st.aura = [pipX - view.x, pipY - view.y, ar, 1];
    st.ringN = Math.min(rings.length, MAX_RINGS);
    for (let i = 0; i < st.ringN; i++) {
      const r = rings[i];
      const t = r.age / ringLife;
      st.ring.set([r.x - view.x, r.y - view.y, 20 + (hearing - 20) * t, 0.55 * (1 - t)], i * 4);
    }

    st.cover = n > 0 || ar > 0 || st.ringN > 0;

    const night = this.night;
    if (night) {
      st.dark = night.darkness;
      st.pip = [pipX - view.x, pipY - view.y, night.pipRadius, 0];
      let li = 0;
      for (const l of night.lamps) {
        if (l.y + l.radius < view.y || l.y - l.radius > view.y + view.height || li >= MAX_LAMPS) continue;
        st.lamp.set([l.x - view.x, l.y - view.y, l.radius, 0], li * 4);
        li++;
      }
      st.lampN = li;
      this.drawBeams(view, officers);
    }
  }

  /** Flashlight beams into the small texture, white at 0.8 so overlapping beams open the dark like the old erase did. */
  private drawBeams(view: Phaser.Geom.Rectangle, officers: PoliceOfficer[]): void {
    const g = this.beamGfx!.clear();
    g.fillStyle(0xffffff, 0.8);
    for (const o of officers) {
      const b = o.beam;
      if (b.length < 6) continue;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < b.length; i += 2) pts.push(new Phaser.Math.Vector2((b[i] - view.x) * BEAM_SCALE, (b[i + 1] - view.y) * BEAM_SCALE));
      g.fillPoints(pts, true);
    }
    this.beamTex!.clear();
    this.beamTex!.draw(g);
    this.beamTex!.render();
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

/** Set by calibration: 1 when the layer's texture has y 0 at the bottom of the screen. */
const FLIP_Y = 0;

/** The cold grade for gray ground: the gray is not neutral but leans blue (red down, blue up, blue lifted in the shadows). */
const COLD = { r: 0.86, g: 0.97, b: 1.14, lift: 9 };

/**
 * Colour matrix for the noir look, t from 0 (untouched) to 1 (full gray with
 * NOIR_CONTRAST added contrast around mid-gray, leaning cold blue). Built by hand: Phaser's
 * ColorMatrix reads offsets in 0..255 units, but its contrast() writes them
 * in 0..1, so its contrast only brightens.
 */
export function noirMatrix(t: number): number[] {
  const v = 1 + NOIR_CONTRAST;
  const g = v / 3; // equal-weight gray, scaled for contrast
  const o = -0.5 * NOIR_CONTRAST * 255; // keeps mid-gray in place (offsets are in 0..255)
  const gray = [
    g * COLD.r, g * COLD.r, g * COLD.r, 0, o * COLD.r,
    g * COLD.g, g * COLD.g, g * COLD.g, 0, o * COLD.g,
    g * COLD.b, g * COLD.b, g * COLD.b, 0, o * COLD.b + COLD.lift,
    0, 0, 0, 1, 0,
  ];
  const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
  return identity.map((a, i) => a + (gray[i] - a) * t);
}


function inside(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}
