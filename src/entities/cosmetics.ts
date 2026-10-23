import Phaser from 'phaser';

type G = Phaser.GameObjects.Graphics;

// All cosmetics draw in local player space, top-down, facing up (negative y),
// centred on (0, 0). The head is a circle of radius 8 at (0, 0); shoulders span
// about x -14..14. Add a new item by adding an entry to one of these tables.

export interface BodyStyle {
  skin: number;
}

export interface OutfitStyle {
  draw: (g: G) => void;
}

export interface HatStyle {
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

export interface PlayerLook {
  body: keyof typeof BODIES;
  outfit: keyof typeof OUTFITS;
  hat: keyof typeof HATS;
}

export const DEFAULT_LOOK: PlayerLook = { body: 'light', outfit: 'vest-magenta', hat: 'beanie' };

// Pools that fellow protestors draw from. The player's outfit is left out.
export const PROTESTOR_OUTFITS = Object.keys(OUTFITS).filter((id) => id !== DEFAULT_LOOK.outfit);
export const PROTESTOR_HATS = Object.keys(HATS);

export function randomProtestorLook(): PlayerLook {
  return {
    body: Phaser.Utils.Array.GetRandom(Object.keys(BODIES)),
    outfit: Phaser.Utils.Array.GetRandom(PROTESTOR_OUTFITS),
    hat: Phaser.Utils.Array.GetRandom(PROTESTOR_HATS),
  };
}
