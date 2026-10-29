import Phaser from 'phaser';
import { ITEMS, type ItemCategory, type ShopItem } from '../data/items';

type G = Phaser.GameObjects.Graphics;

// Every cosmetic has two drawings:
//
// draw (top-down, in the game): local player space facing up (negative y),
// centred on (0, 0). The head is a circle of radius 8 at (0, 0); shoulders
// span about x -14..14; hands sit at (+-15, 2). Signs are held ahead of the
// player and may reach up to y -32.
//
// front (full body facing the viewer, in dialogue and the locker): feet on
// y 0, x centred. Legs and shoes y -20..0, torso x -11..11 and y -44..-18,
// sleeves x +-10..16 down to y -27, hands at (+-13, -24), head a circle of
// radius 9 at (0, -53), top of the head at y -62. Signs are held in the
// right-hand side hand at (13, -24) and may reach up to y -100.
//
// Built-in items live in the tables below; shop items come from
// src/data/items.json and are drawn by the shape recipes at the bottom.

// Front-view anchor points, shared by the body and the recipes.
export const FRONT = { headY: -53, headR: 9, handX: 13, handY: -24, torsoTop: -44, torsoBottom: -18 } as const;

export interface BodyStyle {
  skin: number;
}

/** A cosmetic: a top-down drawing and a front-view drawing. */
export interface ItemStyle {
  draw: (g: G) => void;
  front: (g: G) => void;
}

export type OutfitStyle = ItemStyle;
export type HatStyle = ItemStyle;
export type SignStyle = ItemStyle;

/** Torso and sleeves in front view. Most outfits start from this. */
function shirtFront(g: G, color: number, trim: number): void {
  g.fillStyle(color, 1);
  g.fillRoundedRect(-16, -43, 6, 17, 3).fillRoundedRect(10, -43, 6, 17, 3);
  g.fillRoundedRect(-11, -44, 22, 27, 5);
  g.lineStyle(1.5, trim, 1).strokeRoundedRect(-11, -44, 22, 27, 5);
  g.strokeRoundedRect(-16, -43, 6, 17, 3).strokeRoundedRect(10, -43, 6, 17, 3);
  // Neckline.
  g.fillStyle(trim, 1).fillTriangle(-4, -44, 4, -44, 0, -39);
}

/** A domed cap over the top of the head, from y -53 up. */
function dome(g: G, color: number, r = 9.8, y = -54): void {
  g.fillStyle(color, 1);
  g.beginPath();
  g.arc(0, y, r, Math.PI, 0, false);
  g.closePath();
  g.fillPath();
}

export const BODIES: Record<string, BodyStyle> = {
  light: { skin: 0xf3cfa4 },
  medium: { skin: 0xc68642 },
  dark: { skin: 0x7b4a2a },
};

function shirt(color: number, trim: number): OutfitStyle {
  return {
    draw: (g) => {
      g.fillStyle(color, 1);
      g.fillEllipse(0, 2, 30, 18);
      g.lineStyle(2, trim, 1);
      g.strokeEllipse(0, 2, 30, 18);
    },
    front: (g) => shirtFront(g, color, trim),
  };
}

/** A tee with three stripes across the chest and belly. */
function stripes(color: number, trim: number, stripe: number): OutfitStyle {
  return {
    draw: (g) => {
      shirt(color, trim).draw(g);
      g.fillStyle(stripe, 1).fillRect(-12, -4, 24, 2.5).fillRect(-13, 1, 26, 2.5).fillRect(-12, 6, 24, 2.5);
    },
    front: (g) => {
      shirtFront(g, color, trim);
      g.fillStyle(stripe, 1).fillRect(-11, -40, 22, 2.5).fillRect(-11, -34, 22, 2.5).fillRect(-11, -28, 22, 2.5);
    },
  };
}

function hoodie(color: number, trim: number, hood: number): OutfitStyle {
  return {
    draw: (g) => {
      shirt(color, trim).draw(g);
      // Hood hanging behind the neck.
      g.fillStyle(hood, 1);
      g.fillEllipse(0, 9, 16, 8);
    },
    front: (g) => {
      // Hood bunched behind the neck, then the body and a front pocket.
      g.fillStyle(hood, 1).fillEllipse(0, -44, 20, 7);
      shirtFront(g, color, trim);
      g.fillStyle(hood, 1).fillRoundedRect(-7, -27, 14, 6, 2);
    },
  };
}

export const OUTFITS: Record<string, OutfitStyle> = {
  'tee-red': shirt(0xe0524f, 0x9e2f2c),
  'tee-blue': shirt(0x4f7fd0, 0x2f528e),
  'tee-orange': shirt(0xe8913a, 0xa65e1c),
  'tee-teal': shirt(0x3aa8a0, 0x23716b),
  'tee-grey': shirt(0x9a9ca6, 0x63656e),
  'tee-white': shirt(0xeeeeee, 0xa8a8a8),
  'tee-pink': shirt(0xf06fb0, 0xa83f78),
  'tee-yellow': shirt(0xf2c94c, 0xb8901f),
  'tee-lime': shirt(0x8fd14f, 0x5b9a28),
  'tee-purple': shirt(0x8a5fd6, 0x5a3a99),
  'tee-coral': shirt(0xff7a63, 0xb84a38),
  'tee-sky': shirt(0x62c6f0, 0x3a8bb0),
  'stripe-red': stripes(0xf4efe6, 0xa8a49b, 0xe0524f),
  'stripe-navy': stripes(0xf4efe6, 0xa8a49b, 0x34509e),
  'stripe-green': stripes(0xf4efe6, 0xa8a49b, 0x3aa86b),
  'hoodie-purple': hoodie(0x7b4fc4, 0x4f2f85, 0x5f3aa0),
  'hoodie-red': hoodie(0xd9443f, 0x8f2a27, 0xb23631),
  'hoodie-green': hoodie(0x3f9e5a, 0x276b3b, 0x2f7d45),
  'hoodie-navy': hoodie(0x34416b, 0x1f2742, 0x283356),
  'hoodie-brown': hoodie(0x8a5a3c, 0x5a3823, 0x6e472f),
  'raincoat-yellow': {
    draw: (g) => {
      shirt(0xf2c94c, 0xb8901f).draw(g);
      g.fillStyle(0xb8901f, 1);
      g.fillRect(-1, -6, 2, 14);
    },
    front: (g) => {
      // Long coat down to the knees, with a button line.
      g.fillStyle(0xf2c94c, 1).fillRoundedRect(-12, -44, 24, 34, 5);
      shirtFront(g, 0xf2c94c, 0xb8901f);
      g.fillStyle(0xb8901f, 1).fillRect(-0.75, -40, 1.5, 30);
    },
  },
  // The player's default. Kept out of PROTESTOR_OUTFITS so the player stands out in a crowd.
  'vest-magenta': {
    draw: (g) => {
      shirt(0xff3fa4, 0xffffff).draw(g);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-9, -4, 4, 12);
      g.fillRect(5, -4, 4, 12);
    },
    front: (g) => {
      shirtFront(g, 0xff3fa4, 0xffffff);
      // Reflective strips: two up the front, one across.
      g.fillStyle(0xffffff, 1);
      g.fillRect(-8, -42, 3, 24).fillRect(5, -42, 3, 24).fillRect(-11, -27, 22, 3);
    },
  },
};

function beanie(color: number, bobble: number): HatStyle {
  return {
    draw: (g) => {
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 8.5);
      g.fillStyle(bobble, 1);
      g.fillCircle(0, 0, 3);
    },
    front: (g) => {
      dome(g, color, 10.5, -55);
      g.fillStyle(darken(color), 1).fillRoundedRect(-10.5, -57, 21, 5, 2); // folded cuff
      g.fillStyle(bobble, 1).fillCircle(0, -66, 3.5);
    },
  };
}

function cap(color: number): HatStyle {
  return {
    draw: (g) => {
      g.fillStyle(color, 1);
      g.fillCircle(0, 1, 8.5);
      // Brim points forward (up).
      g.fillEllipse(0, -8, 12, 7);
    },
    front: (g) => {
      dome(g, color);
      g.fillStyle(darken(color), 1).fillEllipse(0, -54, 24, 5); // brim toward the viewer
    },
  };
}

function bucket(color: number, top: number): HatStyle {
  return {
    draw: (g) => {
      g.fillStyle(color, 1);
      g.fillCircle(0, 0, 11);
      g.fillStyle(top, 1);
      g.fillCircle(0, 0, 7.5);
    },
    front: (g) => {
      g.fillStyle(top, 1).fillRoundedRect(-8, -65, 16, 11, 3);
      g.fillStyle(color, 1).fillEllipse(0, -55, 28, 6);
    },
  };
}

const NOTHING: ItemStyle = { draw: () => {}, front: () => {} };

export const HATS: Record<string, HatStyle> = {
  none: NOTHING,
  beanie: beanie(0x4f6fe0, 0xffffff),
  'beanie-red': beanie(0xc0392b, 0xf2f2f2),
  'beanie-grey': beanie(0x6b6e78, 0x2b2d33),
  cap: cap(0x222222),
  'cap-white': cap(0xe6e6e6),
  'cap-green': cap(0x2f6b45),
  bucket: bucket(0xd8c49a, 0xbfa877),
  'bucket-olive': bucket(0x7d8450, 0x646a3d),
};

export const SIGNS: Record<string, SignStyle> = {
  none: NOTHING,
};

// --- Hair -------------------------------------------------------------------------
// A hair layer between the head and the hat, so hats hide hair where they overlap.
// draw: top-down, head circle radius 8 at (0, 0), face toward -y.
// back / front: front view, head circle radius 9 at (0, -53). back is drawn behind the head (long hair,
// the back of a bob), front over the head and under the hat (the cap of hair, fringe, spikes).

export interface HairStyle {
  draw: (g: G, c: number) => void;
  back: (g: G, c: number) => void;
  front: (g: G, c: number) => void;
}

/** Hair colours: the player's (shop ids "hc-...") and the ones protestors and the cast wear. */
export const HAIR_COLORS: Record<string, number> = {
  'hc-brown': 0x6b3f22, // the player's own colour, always owned
  black: 0x231c2a,
  brown: 0x6b3f22,
  darkbrown: 0x2b1d14,
  gold: 0xc9923e,
  blonde: 0xf2cc55,
  ginger: 0xdb5a1e,
  white: 0xe9e6f0,
  red: 0xe0314b,
  pink: 0xff5fae,
  teal: 0x1fcfba,
  lime: 0xa0e32e,
  violet: 0x9a56ff,
  orange: 0xff8a1f,
  blue: 0x3a86ff,
};

/** Spikes around the head from above: n triangles from radius r0 out to r1. */
function ring(g: G, n: number, r0: number, r1: number, spread: number, phase = 0): void {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    g.fillTriangle(
      Math.cos(a - spread) * r0, Math.sin(a - spread) * r0,
      Math.cos(a + spread) * r0, Math.sin(a + spread) * r0,
      Math.cos(a) * r1, Math.sin(a) * r1,
    );
  }
}

const NO_HAIR: HairStyle = { draw: () => {}, back: () => {}, front: () => {} };

export const HAIRSTYLES: Record<string, HairStyle> = {
  none: NO_HAIR,
  buzz: {
    draw: (g, c) => { g.fillStyle(c, 1).fillCircle(0, 1.6, 8.3); },
    back: () => {},
    front: (g, c) => { dome(g, c, 9.6, -54.5); },
  },
  spiky: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      ring(g, 9, 6.5, 13.5, 0.4, 0.3);
      g.fillCircle(0, 1.2, 8.2);
    },
    back: () => {},
    front: (g, c) => {
      g.fillStyle(c, 1);
      for (const [x, h] of [[-8, 6], [-4, 9], [0, 11], [4, 9], [8, 6]]) g.fillTriangle(x - 3.4, -58, x + 3.4, -58, x + x * 0.12, -61 - h);
      dome(g, c, 9.8, -55);
    },
  },
  mohawk: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      g.fillTriangle(-3.6, -9, 3.6, -9, 0, -16);
      g.fillRoundedRect(-3.6, -10, 7.2, 24, 3);
      g.fillTriangle(-3.6, 13, 3.6, 13, 0, 19);
    },
    back: () => {},
    front: (g, c) => {
      g.fillStyle(c, 1);
      g.fillTriangle(-4.5, -60, 4.5, -60, 0, -79);
      g.fillTriangle(-4.5, -64, -1, -72, -7.5, -70);
      g.fillRoundedRect(-4, -72, 8, 17, 3);
    },
  },
  bob: {
    draw: (g, c) => { g.fillStyle(c, 1).fillCircle(0, 1, 10.6); },
    back: (g, c) => { g.fillStyle(c, 1).fillRoundedRect(-11.5, -63, 23, 24, 7); },
    front: (g, c) => {
      dome(g, c, 10.4, -55);
      g.fillStyle(c, 1).fillRoundedRect(-9.6, -60, 19.2, 6.5, 2.5);
    },
  },
  long: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      g.fillEllipse(0, 11, 18, 21);
      g.fillCircle(0, 1.2, 9.2);
    },
    back: (g, c) => { g.fillStyle(c, 1).fillRoundedRect(-12, -63, 24, 36, 8); },
    front: (g, c) => {
      dome(g, c, 10.4, -55);
      g.fillStyle(c, 1).fillRoundedRect(-10.4, -60, 8, 14, 3).fillRoundedRect(2.4, -60, 8, 14, 3);
    },
  },
  curly: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      for (let i = 0; i < 8; i++) g.fillCircle(Math.cos((i / 8) * Math.PI * 2) * 8.4, Math.sin((i / 8) * Math.PI * 2) * 8.4, 4.8);
      g.fillCircle(0, 0, 9);
    },
    back: (g, c) => { g.fillStyle(c, 1).fillCircle(0, -56, 14.5); },
    front: (g, c) => { g.fillStyle(c, 1).fillCircle(-5.5, -61, 4.4).fillCircle(0, -63.5, 4.8).fillCircle(5.5, -61, 4.4); },
  },
  ponytail: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      g.fillEllipse(0, 12, 6, 14);
      g.fillCircle(0, 1.5, 8.4);
    },
    back: (g, c) => { g.fillStyle(c, 1).fillEllipse(11.5, -47, 7, 17); },
    front: (g, c) => { dome(g, c, 9.9, -54.5); },
  },
  bun: {
    draw: (g, c) => {
      g.fillStyle(c, 1);
      g.fillCircle(0, 9.5, 4.8);
      g.fillCircle(0, 1.5, 8.4);
    },
    back: () => {},
    front: (g, c) => {
      dome(g, c, 9.9, -54.5);
      g.fillStyle(c, 1).fillCircle(0, -67, 5);
    },
  },
};

// Hairstyles protestors wear (every one but none), so crowds look different from one another.
export const PROTESTOR_HAIRSTYLES = Object.keys(HAIRSTYLES).filter((id) => id !== 'none');
export const PROTESTOR_HAIR_COLORS = ['black', 'brown', 'blonde', 'ginger', 'white', 'red', 'pink', 'teal', 'lime', 'violet', 'orange', 'blue'];

export interface PlayerLook {
  body: keyof typeof BODIES;
  outfit: keyof typeof OUTFITS;
  hat: keyof typeof HATS;
  sign: keyof typeof SIGNS;
  hair: keyof typeof HAIRSTYLES;
  hairColor: keyof typeof HAIR_COLORS;
}

export const DEFAULT_LOOK: PlayerLook = { body: 'light', outfit: 'vest-magenta', hat: 'beanie', sign: 'none', hair: 'spiky', hairColor: 'hc-brown' };

/** The key of PlayerLook that a shop category sets. */
export const LOOK_KEY: Record<ItemCategory, keyof PlayerLook> = { hat: 'hat', outfit: 'outfit', sign: 'sign', haircolor: 'hairColor' };

// Pools that fellow protestors draw from. Taken before the shop items are
// added below, so bought items and the player's default outfit stay unique.
export const PROTESTOR_OUTFITS = Object.keys(OUTFITS).filter((id) => id !== DEFAULT_LOOK.outfit);
export const PROTESTOR_HATS = Object.keys(HATS);

// Protestor looks come from a fixed pool made once, so a crowd that keeps spawning reuses the same few
// dozen baked textures. The pool is seeded: crowds look the same on every launch.
const LOOK_POOL_SIZE = 72;
let lookPool: PlayerLook[] | null = null;

function makeLookPool(): PlayerLook[] {
  let seed = 20250;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const pick = <T,>(list: T[]): T => list[Math.floor(rand() * list.length)];
  const bodies = Object.keys(BODIES);
  const hats = PROTESTOR_HATS.filter((id) => id !== 'none');
  return Array.from({ length: LOOK_POOL_SIZE }, () => ({
    body: pick(bodies),
    outfit: pick(PROTESTOR_OUTFITS),
    // Most go bare-headed so the hair shows.
    hat: rand() < 0.5 ? 'none' : pick(hats),
    sign: 'none',
    hair: pick(PROTESTOR_HAIRSTYLES),
    hairColor: pick(PROTESTOR_HAIR_COLORS),
  }));
}

export function randomProtestorLook(): PlayerLook {
  lookPool ??= makeLookPool();
  return { ...Phaser.Utils.Array.GetRandom(lookPool) };
}

// --- Story cast ---------------------------------------------------------------
// Worn only by dialogue characters (src/story/cast.json). Added after the
// protestor pools above, so crowds never wear them.

const CAST_OUTFITS: Record<string, OutfitStyle> = {
  'squad-uniform': {
    draw: shirt(0x6f7480, 0x40434c).draw,
    front: (g) => {
      shirtFront(g, 0x6f7480, 0x40434c);
      g.fillStyle(0x2b2d33, 1).fillRect(-11, -24, 22, 3); // belt
      g.fillStyle(0xf2c94c, 1).fillCircle(-5, -36, 2.2); // badge
      // A decibel meter clipped to the belt.
      g.fillStyle(0x1d1f2b, 1).fillRoundedRect(3, -30, 7, 9, 1.5);
      g.fillStyle(0x7be08f, 1).fillRect(4.5, -28.5, 4, 2.5);
    },
  },
  'gus-apron': {
    draw: shirt(0xeeeeee, 0x5ca9e6).draw,
    front: (g) => {
      shirtFront(g, 0xeeeeee, 0xa8a8a8);
      g.fillStyle(0x5ca9e6, 1).fillRoundedRect(-9, -38, 18, 30, 3); // apron to the knees
      g.fillStyle(0x3d7fb3, 1).fillRect(-9, -26, 18, 1.5);
    },
  },
  'ruby-coat': {
    draw: shirt(0xc0392b, 0x7e2219).draw,
    front: (g) => {
      g.fillStyle(0xc0392b, 1).fillRoundedRect(-13, -44, 26, 38, 5); // long coat
      shirtFront(g, 0xc0392b, 0x7e2219);
      g.fillStyle(0x1d1f2b, 1).fillTriangle(-4, -44, 4, -44, 0, -30);
      g.fillStyle(0xf2c94c, 1).fillCircle(-13, -24.5, 1.4).fillCircle(13, -24.5, 1.4); // brass rings
    },
  },
  'quill-suit': {
    draw: shirt(0x5b3f8a, 0x3a2759).draw,
    front: (g) => {
      shirtFront(g, 0x5b3f8a, 0x3a2759);
      g.fillStyle(0xffffff, 1).fillTriangle(-5, -44, 5, -44, 0, -32);
      g.fillStyle(0xd4a017, 1).fillTriangle(-1.5, -42, 1.5, -42, 0, -33); // tie
    },
  },
  // Commuters' office suit (also usable by cast members).
  'gray-suit': {
    draw: (g) => {
      shirt(0x5d6168, 0x3a3d42).draw(g);
      g.fillStyle(0xe8e8e8, 1).fillTriangle(-3, -7, 3, -7, 0, -1); // collar
    },
    front: (g) => {
      shirtFront(g, 0x5d6168, 0x3a3d42);
      g.fillStyle(0xe8e8e8, 1).fillTriangle(-5, -44, 5, -44, 0, -32);
      g.fillStyle(0x2b2d33, 1).fillTriangle(-1.5, -42, 1.5, -42, 0, -32); // tie
      g.fillStyle(0x3a3d42, 1).fillRoundedRect(10, -26, 8, 6, 1.5); // briefcase handle side
    },
  },
};

const CAST_HATS: Record<string, HatStyle> = {
  'squad-cap': {
    draw: cap(0x40434c).draw,
    front: (g) => {
      dome(g, 0x6f7480, 10.5, -56);
      g.fillStyle(0x40434c, 1).fillRect(-11, -58, 22, 4);
      g.fillStyle(0x1d1f2b, 1).fillEllipse(0, -54, 24, 5);
      g.fillStyle(0xf2c94c, 1).fillCircle(0, -61, 2);
    },
  },
};

Object.assign(OUTFITS, CAST_OUTFITS);

/** A commuter in a gray suit, with plain hair in a natural colour or a gray beanie. */
export function commuterLook(): PlayerLook {
  return {
    body: Phaser.Utils.Array.GetRandom(Object.keys(BODIES)),
    outfit: 'gray-suit',
    hat: Phaser.Utils.Array.GetRandom(['none', 'none', 'beanie-grey']),
    sign: 'none',
    hair: Phaser.Utils.Array.GetRandom(['buzz', 'bob', 'bun', 'ponytail']),
    hairColor: Phaser.Utils.Array.GetRandom(['black', 'brown', 'darkbrown', 'white']),
  };
}
Object.assign(HATS, CAST_HATS);

// --- Shop items --------------------------------------------------------------

type Recipe = (g: G, color: number, accent: number) => void;

/** A five-pointed star as one outlined path. */
function star(g: G, cx: number, cy: number, outer: number, inner: number): void {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fillPath();
}

/** Small squares in a checker pattern inside a box, for the scarf. */
function checks(g: G, x: number, y: number, w: number, h: number, size: number, color: number): void {
  g.fillStyle(color, 1);
  for (let j = 0; j * size < h; j++) {
    for (let i = 0; i * size < w; i++) {
      if ((i + j) % 2 === 0) g.fillRect(x + i * size, y + j * size, Math.min(size, w - i * size), Math.min(size, h - j * size));
    }
  }
}

const HAT_SHAPES: Record<string, Recipe> = {
  flowers: (g, c, a) => {
    // A ring of flowers round the head, with leaves between.
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * Math.PI * 2;
      g.fillStyle(0x3fae5a, 1).fillCircle(Math.cos(t + 0.4) * 8.6, Math.sin(t + 0.4) * 8.6, 3.2);
    }
    for (let i = 0; i < 7; i++) {
      const t = (i / 7) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(i % 2 === 0 ? c : a, 1).fillCircle(Math.cos(t) * 8.6, Math.sin(t) * 8.6, 4);
      g.fillStyle(0xfff3c4, 1).fillCircle(Math.cos(t) * 8.6, Math.sin(t) * 8.6, 1.4);
    }
  },
  bandana: (g, c, a) => {
    g.fillStyle(c, 1).fillCircle(0, 0.5, 8.5);
    // Knot and two tails at the back of the head.
    g.fillStyle(c, 1).fillCircle(0, 8, 2.5);
    g.fillTriangle(-1, 8, -6, 15, -2, 15).fillTriangle(1, 8, 6, 15, 2, 15);
    g.fillStyle(a, 1);
    for (const [x, y] of [[-4, -3], [3, -4], [-1, 2], [5, 2], [-5, 4]]) g.fillCircle(x, y, 1.2);
  },
  beret: (g, c, a) => {
    g.fillStyle(c, 1).fillEllipse(-1.5, -0.5, 21, 18);
    g.fillStyle(a, 1).fillCircle(-1.5, -0.5, 2);
  },
  hardhat: (g, c, a) => {
    g.fillStyle(a, 1).fillEllipse(0, -1, 24, 22); // brim all round, wider at the front
    g.fillStyle(c, 1).fillCircle(0, 0.5, 8.5);
    g.fillStyle(a, 1).fillRect(-1.5, -8, 3, 16); // ridge
  },
  crown: (g, c, a) => {
    // Seen from above: a ring of five points with jewels.
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle(c, 1).fillTriangle(
        Math.cos(t - 0.45) * 7, Math.sin(t - 0.45) * 7,
        Math.cos(t + 0.45) * 7, Math.sin(t + 0.45) * 7,
        Math.cos(t) * 12.5, Math.sin(t) * 12.5,
      );
    }
    g.lineStyle(3.5, c, 1).strokeCircle(0, 0, 7.5);
    g.fillStyle(a, 1);
    for (let i = 0; i < 5; i++) {
      const t = (i / 5) * Math.PI * 2 - Math.PI / 2;
      g.fillCircle(Math.cos(t) * 7.5, Math.sin(t) * 7.5, 1.6);
    }
  },
};

const OUTFIT_SHAPES: Record<string, Recipe> = {
  studded: (g, c, a) => {
    shirt(c, darken(c)).draw(g);
    // Spiked shoulders, a zip and a row of studs across the back.
    g.fillStyle(a, 1);
    g.fillTriangle(-17, 0, -11, -5, -11, 4).fillTriangle(17, 0, 11, -5, 11, 4);
    g.fillRect(-0.75, -6, 1.5, 15);
    for (let x = -9; x <= 9; x += 4.5) g.fillCircle(x, 7, 1.4);
  },
  scarf: (g, c, a) => {
    shirt(0x4a6fa5, 0x2f4a73).draw(g);
    // Checkered scarf round the neck with a tail down the back.
    g.fillStyle(c, 1).fillRect(-3.5, 6, 7, 11);
    checks(g, -3.5, 6, 7, 11, 3.5, a);
    g.fillStyle(c, 1).fillEllipse(0, 0, 22, 14);
    for (const [x, y] of [[-8, -2], [-4, 2], [0, -4], [4, 2], [8, -2], [-4, -4], [4, -4]]) g.fillStyle(a, 1).fillRect(x - 1.7, y - 1.7, 3.4, 3.4);
  },
  tracksuit: (g, c, a) => {
    shirt(c, darken(c)).draw(g);
    g.fillStyle(a, 1);
    g.fillRect(-12, -2, 2.5, 9).fillRect(9.5, -2, 2.5, 9); // stripes down the arms
    g.fillRect(-0.75, -6, 1.5, 15); // zip
  },
  jersey: (g, c, a) => {
    shirt(c, a).draw(g);
    // Big number circle on the back.
    g.fillStyle(a, 1).fillCircle(0, 6, 4.5);
    g.fillStyle(c, 1).fillRect(-0.9, 3.5, 1.8, 5);
  },
  poncho: (g, c, a) => {
    g.fillStyle(c, 1).fillRoundedRect(-17, -7, 34, 19, 7);
    g.lineStyle(2, darken(c), 1).strokeRoundedRect(-17, -7, 34, 19, 7);
    g.fillStyle(a, 1);
    g.fillRect(-17, 1, 34, 2.5);
    for (let x = -14; x <= 14; x += 7) g.fillTriangle(x - 2.5, 7, x + 2.5, 7, x, 10.5);
  },
  cape: (g, c, a) => {
    // Cape flowing back behind the shoulders, then a plain top.
    g.fillStyle(c, 1).fillTriangle(-14, 2, 14, 2, 0, 24);
    g.fillEllipse(-7, 14, 14, 18).fillEllipse(7, 14, 14, 18);
    shirt(a, darken(a)).draw(g);
    g.fillStyle(c, 1).fillCircle(0, -2, 3);
  },
};

const SIGN_SHAPES: Record<string, Recipe> = {
  star: (g, c, a) => {
    g.fillStyle(0x8a6a44, 1).fillRect(13.5, -18, 3, 20);
    g.fillStyle(c, 1);
    star(g, 15, -27, 12, 5.5);
    g.fillStyle(a, 1).fillCircle(15, -27, 3);
  },
  placard: (g, c, a) => {
    g.fillStyle(0x8a6a44, 1).fillRect(13.5, -24, 3, 26); // stick from the right hand
    g.fillStyle(c, 1).fillRect(-6, -32, 26, 15);
    g.lineStyle(1.5, darken(c), 1).strokeRect(-6, -32, 26, 15);
    g.fillStyle(a, 1).fillRect(-3, -28.5, 20, 2.5).fillRect(-3, -23.5, 14, 2.5);
  },
  lollipop: (g, c, a) => {
    g.fillStyle(0x6b6e78, 1).fillRect(13.5, -22, 3, 24);
    g.fillStyle(c, 1).fillCircle(15, -24, 9);
    g.lineStyle(3, a, 1).strokeCircle(15, -24, 7.5);
    g.lineStyle(3, a, 1).lineBetween(10, -29, 20, -19);
  },
  flag: (g, c, a) => {
    g.fillStyle(0xd8d8d8, 1).fillRect(14, -32, 2, 34);
    g.fillStyle(c, 1).fillTriangle(16, -32, 16, -18, 32, -26);
    g.fillStyle(a, 1).fillCircle(21, -25.5, 2.5);
  },
  banner: (g, c, a) => {
    // Held by both hands, stretched across in front of the player.
    g.fillStyle(0x8a6a44, 1).fillRect(-16.5, -22, 3, 24).fillRect(13.5, -22, 3, 24);
    g.fillStyle(c, 1).fillRect(-18, -30, 36, 12);
    g.lineStyle(1.5, darken(c), 1).strokeRect(-18, -30, 36, 12);
    g.fillStyle(a, 1);
    for (let x = -14; x <= 10; x += 6) g.fillRect(x, -26, 4, 4);
  },
};

function darken(color: number): number {
  const c = Phaser.Display.Color.IntegerToColor(color).darken(30);
  return c.color;
}

// Front-view recipes, in the front-view space described at the top of the file.
const FRONT_HAT_SHAPES: Record<string, Recipe> = {
  flowers: (g, c, a) => {
    for (let i = -4; i <= 4; i++) {
      const x = i * 2.5;
      const y = -61 + i * i * 0.2;
      g.fillStyle(0x3fae5a, 1).fillCircle(x + 1.2, y + 1.8, 2.4);
      g.fillStyle(i % 2 === 0 ? c : a, 1).fillCircle(x, y, 3.2);
      g.fillStyle(0xfff3c4, 1).fillCircle(x, y, 1.1);
    }
  },
  bandana: (g, c, a) => {
    dome(g, c, 10, -53);
    g.fillStyle(c, 1).fillRect(-10, -54, 20, 3);
    // Knot and tails at the side of the head.
    g.fillCircle(10, -53, 2.5).fillTriangle(10, -53, 16, -47, 13, -45).fillTriangle(10, -53, 15, -55, 16, -51);
    g.fillStyle(a, 1);
    for (const [x, y] of [[-5, -58], [2, -60], [6, -56], [-1, -55]]) g.fillCircle(x, y, 1.2);
  },
  beret: (g, c, a) => {
    g.fillStyle(c, 1).fillEllipse(-2, -60, 26, 10);
    g.fillRect(-9, -60, 18, 4);
    g.fillStyle(a, 1).fillCircle(-2, -65.5, 1.8);
  },
  hardhat: (g, c, a) => {
    dome(g, c, 11, -56);
    g.fillStyle(a, 1).fillRoundedRect(-15, -57, 30, 3.5, 1.5); // brim
    g.fillRect(-1.5, -67, 3, 10); // ridge
  },
  crown: (g, c, a) => {
    g.fillStyle(c, 1).fillRect(-9, -64, 18, 6);
    g.fillTriangle(-9, -64, -5, -64, -8, -72).fillTriangle(-2.5, -64, 2.5, -64, 0, -74).fillTriangle(5, -64, 9, -64, 8, -72);
    g.fillStyle(a, 1).fillCircle(-5, -61, 1.6).fillCircle(0, -61, 1.6).fillCircle(5, -61, 1.6).fillCircle(0, -74, 1.4);
  },
};

const FRONT_OUTFIT_SHAPES: Record<string, Recipe> = {
  studded: (g, c, a) => {
    shirtFront(g, c, darken(c));
    g.fillStyle(a, 1);
    g.fillTriangle(-8, -44, -2, -44, -5, -33).fillTriangle(8, -44, 2, -44, 5, -33); // lapels
    g.fillTriangle(-17, -43, -11, -47, -11, -40).fillTriangle(17, -43, 11, -47, 11, -40); // shoulder spikes
    g.fillRect(-0.75, -34, 1.5, 17);
    for (const [x, y] of [[-8, -30], [-8, -25], [-8, -20], [8, -30], [8, -25], [8, -20], [-14, -38], [14, -38]]) g.fillCircle(x, y, 1.4);
    g.fillStyle(0x15111a, 1).fillRect(-11, -20, 22, 3);
  },
  scarf: (g, c, a) => {
    shirtFront(g, 0x4a6fa5, 0x2f4a73);
    g.fillStyle(c, 1).fillRect(2, -43, 7, 19);
    checks(g, 2, -43, 7, 19, 3.5, a);
    g.fillStyle(c, 1).fillRoundedRect(-10.5, -48, 21, 7, 3);
    checks(g, -10.5, -48, 21, 7, 3.5, a);
  },
  tracksuit: (g, c, a) => {
    shirtFront(g, c, darken(c));
    g.fillStyle(a, 1);
    g.fillRect(-14, -42, 2, 15).fillRect(12, -42, 2, 15); // stripes down the arms
    g.fillRect(-0.75, -40, 1.5, 22); // zip
  },
  jersey: (g, c, a) => {
    shirtFront(g, c, a);
    // Big number 7 on the chest.
    g.fillStyle(a, 1).fillRect(-4, -38, 8, 2.5).fillTriangle(4, -38, 1, -26, 3.5, -38);
    g.fillRect(-16, -31, 6, 2).fillRect(10, -31, 6, 2); // sleeve bands
  },
  poncho: (g, c, a) => {
    // Covers the arms; the hands poke out under it.
    g.fillStyle(c, 1).fillTriangle(0, -46, -19, -24, 19, -24);
    g.fillRect(-19, -30, 38, 6);
    g.fillStyle(a, 1).fillRect(-17, -32, 34, 2.5);
    for (let x = -16; x <= 16; x += 6.4) g.fillTriangle(x - 2.5, -24, x + 2.5, -24, x, -20);
  },
  cape: (g, c, a) => {
    // Cape edges spread out behind the shoulders, then a plain top and a clasp.
    g.fillStyle(c, 1).fillTriangle(-10, -44, -22, -8, -10, -8).fillTriangle(10, -44, 22, -8, 10, -8);
    shirtFront(g, a, darken(a));
    g.fillStyle(c, 1).fillCircle(-8, -42, 2.5).fillCircle(8, -42, 2.5);
  },
};

const FRONT_SIGN_SHAPES: Record<string, Recipe> = {
  star: (g, c, a) => {
    g.fillStyle(0x8a6a44, 1).fillRect(11.5, -72, 3, 50);
    g.fillStyle(c, 1);
    star(g, 13, -88, 15, 7);
    g.fillStyle(a, 1).fillCircle(13, -88, 4);
  },
  placard: (g, c, a) => {
    g.fillStyle(0x8a6a44, 1).fillRect(11.5, -72, 3, 50);
    g.fillStyle(c, 1).fillRect(-4, -92, 34, 22);
    g.lineStyle(1.5, darken(c), 1).strokeRect(-4, -92, 34, 22);
    g.fillStyle(a, 1).fillRect(0, -87, 26, 3).fillRect(0, -80, 18, 3);
  },
  lollipop: (g, c, a) => {
    g.fillStyle(0x6b6e78, 1).fillRect(11.5, -72, 3, 50);
    g.fillStyle(c, 1).fillCircle(13, -82, 12);
    g.lineStyle(3, a, 1).strokeCircle(13, -82, 10).lineBetween(6, -89, 20, -75);
  },
  flag: (g, c, a) => {
    g.fillStyle(0xd8d8d8, 1).fillRect(12, -100, 2.5, 78);
    g.fillStyle(c, 1).fillTriangle(14.5, -100, 14.5, -80, 36, -90);
    g.fillStyle(a, 1).fillCircle(21, -90, 3);
  },
  banner: (g, c, a) => {
    // Held up in both hands, stretched across above the head.
    g.fillStyle(0x8a6a44, 1).fillRect(-14.5, -70, 3, 48).fillRect(11.5, -70, 3, 48);
    g.fillStyle(c, 1).fillRect(-22, -86, 44, 18);
    g.lineStyle(1.5, darken(c), 1).strokeRect(-22, -86, 44, 18);
    g.fillStyle(a, 1);
    for (let x = -17; x <= 13; x += 7.5) g.fillRect(x, -79.5, 4, 5);
  },
};

function hex(color: string): number {
  return Phaser.Display.Color.HexStringToColor(color).color;
}

function shopStyle(item: ShopItem): ItemStyle {
  const category = item.category as Exclude<ItemCategory, 'haircolor'>;
  const top = { hat: HAT_SHAPES, outfit: OUTFIT_SHAPES, sign: SIGN_SHAPES }[category][item.shape];
  const front = { hat: FRONT_HAT_SHAPES, outfit: FRONT_OUTFIT_SHAPES, sign: FRONT_SIGN_SHAPES }[category][item.front];
  const color = hex(item.color);
  const accent = hex(item.accent);
  return { draw: (g) => top(g, color, accent), front: (g) => front(g, color, accent) };
}

const TABLES = { hat: HATS, outfit: OUTFITS, sign: SIGNS };
for (const item of ITEMS) {
  if (item.category === 'haircolor') HAIR_COLORS[item.id] = hex(item.color);
  else TABLES[item.category as keyof typeof TABLES][item.id] = shopStyle(item);
}

/** The item each category starts with, always owned. */
export const DEFAULT_ITEMS: Record<ItemCategory, string> = {
  hat: DEFAULT_LOOK.hat, outfit: DEFAULT_LOOK.outfit, sign: DEFAULT_LOOK.sign, haircolor: DEFAULT_LOOK.hairColor,
};

/** True when id names something that category can draw. */
export function isKnownItem(category: ItemCategory, id: string): boolean {
  return Object.hasOwn(category === 'haircolor' ? HAIR_COLORS : TABLES[category], id);
}
