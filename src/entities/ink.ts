import Phaser from 'phaser';

/**
 * The comic look for drawn characters: every filled shape gets a thick dark outline and, when it is big
 * enough, one shade tone (a darker crescent on its lower right). It works by wrapping the fill methods of a
 * Graphics, so the drawing recipes in cosmetics.ts stay plain "fillStyle(colour).fillCircle(...)" calls.
 * Small details (stripes, studs, text lines) are left without an outline so they do not turn into blobs.
 */
export const INK = 0x1b1424; // outline colour: a very dark violet, warmer than black

/** Smallest shape (radius, or the shorter side) that gets an outline, and the smallest that also gets the shade tone. */
const OUTLINE_MIN = 3;
const SHADE_MIN = 5;
const SHADE_OFFSET = 0.16; // how far the light shape is pulled to the upper left, as a share of its size

type G = Phaser.GameObjects.Graphics;
const P = Phaser.GameObjects.Graphics.prototype;

/** The shade tone of a colour: darker and a little cooler. */
export function shadeOf(color: number): number {
  const r = Math.floor(((color >> 16) & 255) * 0.7);
  const g = Math.floor(((color >> 8) & 255) * 0.72);
  const b = Math.floor((color & 255) * 0.85);
  return (r << 16) | (g << 8) | b;
}

/** Makes g draw outlined, shaded shapes. width is the outline thickness in the Graphics' own units. */
export function inkify(g: G, width: number): G {
  let color = 0xffffff;
  let alpha = 1;
  const solid = () => alpha >= 1;
  const outline = () => P.lineStyle.call(g, width, INK, 1);

  g.fillStyle = function (c: number, a = 1) {
    color = c;
    alpha = a;
    return P.fillStyle.call(g, c, a) as G;
  } as G['fillStyle'];

  g.fillCircle = function (x: number, y: number, r: number) {
    if (!solid() || r < OUTLINE_MIN) return P.fillCircle.call(g, x, y, r) as G;
    if (r >= SHADE_MIN) {
      P.fillStyle.call(g, shadeOf(color), 1);
      P.fillCircle.call(g, x, y, r);
      P.fillStyle.call(g, color, 1);
      P.fillCircle.call(g, x - SHADE_OFFSET * r, y - SHADE_OFFSET * r, r * (1 - SHADE_OFFSET));
    } else P.fillCircle.call(g, x, y, r);
    outline();
    return P.strokeCircle.call(g, x, y, r) as G;
  } as G['fillCircle'];

  g.fillEllipse = function (x: number, y: number, w: number, h: number) {
    const small = Math.min(w, h) / 2;
    if (!solid() || small < OUTLINE_MIN) return P.fillEllipse.call(g, x, y, w, h) as G;
    if (small >= SHADE_MIN) {
      P.fillStyle.call(g, shadeOf(color), 1);
      P.fillEllipse.call(g, x, y, w, h);
      P.fillStyle.call(g, color, 1);
      P.fillEllipse.call(g, x - (SHADE_OFFSET / 2) * w, y - (SHADE_OFFSET / 2) * h, w * (1 - SHADE_OFFSET), h * (1 - SHADE_OFFSET));
    } else P.fillEllipse.call(g, x, y, w, h);
    outline();
    return P.strokeEllipse.call(g, x, y, w, h) as G;
  } as G['fillEllipse'];

  g.fillRect = function (x: number, y: number, w: number, h: number) {
    const small = Math.min(Math.abs(w), Math.abs(h));
    if (!solid() || small < OUTLINE_MIN + 1) return P.fillRect.call(g, x, y, w, h) as G;
    if (small >= SHADE_MIN * 2) {
      const s = SHADE_OFFSET * small;
      P.fillStyle.call(g, shadeOf(color), 1);
      P.fillRect.call(g, x, y, w, h);
      P.fillStyle.call(g, color, 1);
      P.fillRect.call(g, x, y, w - s, h - s);
    } else P.fillRect.call(g, x, y, w, h);
    outline();
    return P.strokeRect.call(g, x, y, w, h) as G;
  } as G['fillRect'];

  g.fillRoundedRect = function (x: number, y: number, w: number, h: number, radius: number | Phaser.Types.GameObjects.Graphics.RoundedRectRadius = 20) {
    const small = Math.min(Math.abs(w), Math.abs(h));
    if (!solid() || small < OUTLINE_MIN + 1) return P.fillRoundedRect.call(g, x, y, w, h, radius) as G;
    if (small >= SHADE_MIN * 2) {
      const s = SHADE_OFFSET * small;
      P.fillStyle.call(g, shadeOf(color), 1);
      P.fillRoundedRect.call(g, x, y, w, h, radius);
      P.fillStyle.call(g, color, 1);
      P.fillRoundedRect.call(g, x, y, w - s, h - s, radius);
    } else P.fillRoundedRect.call(g, x, y, w, h, radius);
    outline();
    return P.strokeRoundedRect.call(g, x, y, w, h, radius) as G;
  } as G['fillRoundedRect'];

  g.fillTriangle = function (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) {
    P.fillTriangle.call(g, x1, y1, x2, y2, x3, y3);
    const area = Math.abs((x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1)) / 2;
    if (!solid() || area < 14) return g;
    outline();
    return P.strokeTriangle.call(g, x1, y1, x2, y2, x3, y3) as G;
  } as G['fillTriangle'];

  g.fillPath = function () {
    P.fillPath.call(g);
    if (!solid()) return g;
    outline();
    return P.strokePath.call(g) as G;
  } as G['fillPath'];

  return g;
}
