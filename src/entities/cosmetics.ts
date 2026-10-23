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

export const OUTFITS: Record<string, OutfitStyle> = {
  'tee-red': shirt(0xe0524f, 0x9e2f2c),
  'hoodie-green': {
    draw: (g) => {
      shirt(0x3f9e5a, 0x276b3b).draw(g);
      // Hood hanging behind the neck.
      g.fillStyle(0x2f7d45, 1);
      g.fillEllipse(0, 9, 16, 8);
    },
  },
  'raincoat-yellow': {
    draw: (g) => {
      shirt(0xf2c94c, 0xb8901f).draw(g);
      g.fillStyle(0xb8901f, 1);
      g.fillRect(-1, -6, 2, 14);
    },
  },
};

export const HATS: Record<string, HatStyle> = {
  none: { draw: () => {} },
  beanie: {
    draw: (g) => {
      g.fillStyle(0x4f6fe0, 1);
      g.fillCircle(0, 0, 8.5);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(0, 0, 3);
    },
  },
  cap: {
    draw: (g) => {
      g.fillStyle(0x222222, 1);
      g.fillCircle(0, 1, 8.5);
      // Brim points forward (up).
      g.fillEllipse(0, -8, 12, 7);
    },
  },
  bucket: {
    draw: (g) => {
      g.fillStyle(0xd8c49a, 1);
      g.fillCircle(0, 0, 11);
      g.fillStyle(0xbfa877, 1);
      g.fillCircle(0, 0, 7.5);
    },
  },
};

export interface PlayerLook {
  body: keyof typeof BODIES;
  outfit: keyof typeof OUTFITS;
  hat: keyof typeof HATS;
}

export const DEFAULT_LOOK: PlayerLook = { body: 'light', outfit: 'hoodie-green', hat: 'beanie' };
