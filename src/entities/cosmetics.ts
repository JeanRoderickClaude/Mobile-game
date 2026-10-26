import Phaser from 'phaser';
import { ITEMS, type ShopItem } from '../data/items';

type G = Phaser.GameObjects.Graphics;

// All cosmetics draw in local player space, top-down, facing up (negative y),
// centred on (0, 0). The head is a circle of radius 8 at (0, 0); shoulders span
// about x -14..14; hands sit at (+-15, 2). Signs are held ahead of the
// player and may reach up to y -32. Built-in items live in the tables below;
// shop items come from src/data/items.json and are drawn by the shape
// recipes at the bottom of this file.

export interface BodyStyle {
  skin: number;
}

export interface OutfitStyle {
  draw: (g: G) => void;
}

export interface HatStyle {
  draw: (g: G) => void;
}

export interface SignStyle {
  draw: (g: G) => void;
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
  },
  // The player's default. Kept out of PROTESTOR_OUTFITS so the player stands out in a crowd.
  'vest-magenta': {
    draw: (g) => {
      shirt(0xff3fa4, 0xffffff).draw(g);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-9, -4, 4, 12);
      g.fillRect(5, -4, 4, 12);
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
  };
}

export const HATS: Record<string, HatStyle> = {
  none: { draw: () => {} },
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
  none: { draw: () => {} },
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

function shopDraw(item: ShopItem): (g: G) => void {
  const recipes = { hat: HAT_SHAPES, outfit: OUTFIT_SHAPES, sign: SIGN_SHAPES }[item.category];
  const recipe = recipes[item.shape];
  const color = Phaser.Display.Color.HexStringToColor(item.color).color;
  const accent = Phaser.Display.Color.HexStringToColor(item.accent).color;
  return (g) => recipe(g, color, accent);
}

const TABLES = { hat: HATS, outfit: OUTFITS, sign: SIGNS };
for (const item of ITEMS) TABLES[item.category][item.id] = { draw: shopDraw(item) };

/** The item each category starts with, always owned. */
export const DEFAULT_ITEMS = { hat: DEFAULT_LOOK.hat, outfit: DEFAULT_LOOK.outfit, sign: DEFAULT_LOOK.sign };

/** True when id names something that category can draw. */
export function isKnownItem(category: keyof typeof TABLES, id: string): boolean {
  return Object.hasOwn(TABLES[category], id);
}
