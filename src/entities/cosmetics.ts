import Phaser from 'phaser';
import { ITEMS, type ShopItem } from '../data/items';

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

export interface PlayerLook {
  body: keyof typeof BODIES;
  outfit: keyof typeof OUTFITS;
  hat: keyof typeof HATS;
  sign: keyof typeof SIGNS;
}

export const DEFAULT_LOOK: PlayerLook = { body: 'light', outfit: 'vest-magenta', hat: 'beanie', sign: 'none' };

// Pools that fellow protestors draw from. Taken before the shop items are
// added below, so bought items and the player's default outfit stay unique.
export const PROTESTOR_OUTFITS = Object.keys(OUTFITS).filter((id) => id !== DEFAULT_LOOK.outfit);
export const PROTESTOR_HATS = Object.keys(HATS);

export function randomProtestorLook(): PlayerLook {
  return {
    body: Phaser.Utils.Array.GetRandom(Object.keys(BODIES)),
    outfit: Phaser.Utils.Array.GetRandom(PROTESTOR_OUTFITS),
    hat: Phaser.Utils.Array.GetRandom(PROTESTOR_HATS),
    sign: 'none',
  };
}

// --- Story cast ---------------------------------------------------------------
// Worn only by dialogue characters (src/story/cast.json). Added after the
// protestor pools above, so crowds never wear them.

/** Hair, drawn in the hat layer for cast members without a hat. */
function hair(color: number, bun: boolean): HatStyle {
  return {
    draw: (g) => {
      g.fillStyle(color, 1).fillCircle(0, 1.5, 8.5);
      if (bun) g.fillCircle(0, 9, 3.5);
    },
    front: (g) => {
      dome(g, color, 9.8, -53);
      g.fillStyle(color, 1).fillRect(-9.8, -54, 3, 7).fillRect(6.8, -54, 3, 7);
      if (bun) g.fillCircle(0, -65, 4.5);
    },
  };
}

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
  'hair-bun': hair(0x2b1d14, true),
  'hair-bob': hair(0xb07a3a, false),
};

Object.assign(OUTFITS, CAST_OUTFITS);

/** A commuter in a gray suit, with plain hair or a gray beanie. */
export function commuterLook(): PlayerLook {
  return {
    body: Phaser.Utils.Array.GetRandom(Object.keys(BODIES)),
    outfit: 'gray-suit',
    hat: Phaser.Utils.Array.GetRandom(['hair-bob', 'hair-bun', 'none', 'beanie-grey']),
    sign: 'none',
  };
}
Object.assign(HATS, CAST_HATS);

// --- Shop items --------------------------------------------------------------

type Recipe = (g: G, color: number, accent: number) => void;

const HAT_SHAPES: Record<string, Recipe> = {
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
  const top = { hat: HAT_SHAPES, outfit: OUTFIT_SHAPES, sign: SIGN_SHAPES }[item.category][item.shape];
  const front = { hat: FRONT_HAT_SHAPES, outfit: FRONT_OUTFIT_SHAPES, sign: FRONT_SIGN_SHAPES }[item.category][item.front];
  const color = hex(item.color);
  const accent = hex(item.accent);
  return { draw: (g) => top(g, color, accent), front: (g) => front(g, color, accent) };
}

const TABLES = { hat: HATS, outfit: OUTFITS, sign: SIGNS };
for (const item of ITEMS) TABLES[item.category][item.id] = shopStyle(item);

/** The item each category starts with, always owned. */
export const DEFAULT_ITEMS = { hat: DEFAULT_LOOK.hat, outfit: DEFAULT_LOOK.outfit, sign: DEFAULT_LOOK.sign };

/** True when id names something that category can draw. */
export function isKnownItem(category: keyof typeof TABLES, id: string): boolean {
  return Object.hasOwn(TABLES[category], id);
}
