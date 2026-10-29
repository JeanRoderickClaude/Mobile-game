import Phaser from 'phaser';

/** One static thing to bake: the world rectangle it covers and a function that draws it in world coordinates. */
export interface BakeItem {
  x: number;
  y: number;
  width: number;
  height: number;
  draw: (g: Phaser.GameObjects.Graphics) => void;
}

const ATLAS_WIDTH = 2048;
const MARGIN = 3; // room for outline antialiasing around each item

/**
 * Bakes many small statics (buildings, cars, lamp posts) into one atlas
 * texture and shows each as an Image at its place in the world. Only the
 * area the items cover is ever drawn, so there is no full-screen overlay to
 * fill, and the renderer batches all of them in one draw call.
 */
export function bakeAtlas(scene: Phaser.Scene, name: string, depth: number, items: BakeItem[]): Phaser.GameObjects.Image[] {
  // Shelf packing, tallest first.
  const boxes = items.map((it) => ({ it, w: Math.ceil(it.width) + MARGIN * 2, h: Math.ceil(it.height) + MARGIN * 2, px: 0, py: 0 }));
  boxes.sort((a, b) => b.h - a.h);
  let x = 0, y = 0, rowH = 0;
  for (const b of boxes) {
    if (x + b.w > ATLAS_WIDTH) { x = 0; y += rowH; rowH = 0; }
    b.px = x; b.py = y; x += b.w; rowH = Math.max(rowH, b.h);
  }
  const height = y + rowH;
  const key = `bake:${name}`;
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addDynamicTexture(key, ATLAS_WIDTH, Math.max(1, height))!;
  const g = scene.make.graphics({}, false);
  const images: Phaser.GameObjects.Image[] = [];
  boxes.forEach((b, i) => {
    g.clear();
    b.it.draw(g);
    // The item's world top-left (minus the margin) lands on its slot in the atlas.
    tex.draw(g, b.px + MARGIN - b.it.x, b.py + MARGIN - b.it.y);
    tex.render();
    const frame = `i${i}`;
    tex.add(frame, 0, b.px, b.py, b.w, b.h);
    images.push(scene.add.image(b.it.x - MARGIN, b.it.y - MARGIN, key, frame).setOrigin(0).setDepth(depth));
  });
  g.destroy();
  return images;
}
