import Phaser from 'phaser';
import { inkify } from './ink';

const RES = 2; // cached at twice the size for sharpness

/** Draws Ruby's instrument case lying along x, centred on (0, 0): about 30 by 18 units. */
export function drawCase(g: Phaser.GameObjects.Graphics): void {
  g.fillStyle(0x7a4a1f, 1).fillRoundedRect(-15, -9, 30, 18, 3); // leather body
  g.fillStyle(0x9a6430, 1).fillRect(-13, -7, 26, 6); // lid highlight
  g.fillStyle(0xd9a93a, 1).fillRect(-4, -11, 8, 3); // handle
  g.fillStyle(0xf2c94c, 1).fillRect(-9, -1, 4, 4).fillRect(5, -1, 4, 4); // latches
}

/** The case as one cached texture (key "instrument-case"), 48 units square. */
export function caseTexture(scene: Phaser.Scene): string {
  const key = 'instrument-case';
  if (scene.textures.exists(key)) return key;
  const size = 48 * RES;
  const g = inkify(scene.make.graphics({}, false), 1.25);
  drawCase(g);
  g.setScale(RES);
  const dt = scene.textures.addDynamicTexture(key, size, size)!;
  dt.draw(g, size / 2, size / 2).render();
  g.destroy();
  return key;
}

/** An Image of the case at (x, y), the right size. */
export function makeCaseImage(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Image {
  return scene.add.image(x, y, caseTexture(scene)).setScale(1 / RES);
}
