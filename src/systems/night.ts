import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import type { PoliceOfficer } from '../entities/PoliceOfficer';
import type { LightData } from '../levels/types';

const SCALE = 0.5; // the darkness texture is drawn at half resolution; its edges are soft anyway
const KEY = 'night-overlay';

/**
 * Darkens the screen at night, except for a radius around Pip, the lamps'
 * pools and the officers' flashlight beams, so the player can always read
 * where the light is. A half-size DynamicTexture is filled with darkness each
 * frame and the lights are erased out of it with soft edges; an image shows
 * it over the world, scaled up to the screen.
 */
export class NightOverlay {
  private texture: Phaser.Textures.DynamicTexture;
  private image: Phaser.GameObjects.Image;
  private lights: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private lamps: LightData[], private darkness: number, private pipRadius: number) {
    const textures = scene.textures;
    if (textures.exists(KEY)) textures.remove(KEY);
    this.texture = textures.addDynamicTexture(KEY, GAME_WIDTH * SCALE, GAME_HEIGHT * SCALE)!;
    this.image = scene.add.image(0, 0, KEY).setOrigin(0).setScale(1 / SCALE).setScrollFactor(0).setDepth(35);
    this.lights = scene.make.graphics({}, false);
  }

  update(view: Phaser.Geom.Rectangle, pipX: number, pipY: number, officers: PoliceOfficer[]): void {
    const g = this.lights.clear();
    // Work in half-size screen space.
    const sx = (x: number) => (x - view.x) * SCALE;
    const sy = (y: number) => (y - view.y) * SCALE;
    const soft = (x: number, y: number, r: number) => {
      g.fillStyle(0xffffff, 0.45).fillCircle(sx(x), sy(y), r * SCALE);
      g.fillStyle(0xffffff, 0.35).fillCircle(sx(x), sy(y), r * SCALE * 0.85);
      g.fillStyle(0xffffff, 0.3).fillCircle(sx(x), sy(y), r * SCALE * 0.68);
    };
    for (const l of this.lamps) {
      if (l.y + l.radius < view.y || l.y - l.radius > view.y + view.height) continue;
      soft(l.x, l.y, l.radius);
    }
    soft(pipX, pipY, this.pipRadius);
    g.fillStyle(0xffffff, 0.8);
    for (const o of officers) {
      const b = o.beam;
      if (b.length < 6) continue;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i < b.length; i += 2) pts.push(new Phaser.Math.Vector2(sx(b[i]), sy(b[i + 1])));
      g.fillPoints(pts, true);
    }
    this.texture.clear();
    this.texture.fill(0x05070f, this.darkness);
    this.texture.erase(g);
    this.texture.render();
  }

  destroy(): void {
    this.image.destroy();
    this.lights.destroy();
  }
}
