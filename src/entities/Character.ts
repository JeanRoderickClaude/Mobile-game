import Phaser from 'phaser';
import { CHARACTER_SCALE } from '../config';
import { BODIES, DEFAULT_LOOK, HATS, OUTFITS, type PlayerLook } from './cosmetics';

/**
 * A protestor: the player or a crowd member. Drawn from stacked layers so each
 * can be swapped on its own:
 *   body  - hands and skin tone (also used for the head)
 *   outfit - shirt, hoodie, coat
 *   head  - drawn from the body's skin tone, above the outfit
 *   hat   - topmost layer
 * The player also gets a marker ring underneath so they stand out in a crowd.
 * Crowd members are "baked": the layers are rendered once into a texture shared
 * by every character with the same look, and shown as one image. That keeps
 * 30+ protestors cheap to draw, at the cost of the hand swing animation.
 * Movement lives in GameScene (player) and Crowd (others); this class only
 * handles looks and facing.
 */
export interface CharacterOptions {
  /** Draw the player's marker ring underneath. */
  marker?: boolean;
  /** Render as one cached image instead of live layers. */
  baked?: boolean;
}

const BAKE_RES = 2; // baked textures are drawn at this multiple for sharpness
const BAKE_SIZE = 48 * BAKE_RES; // covers local space -24..24

export class Character extends Phaser.GameObjects.Container {
  private bodyLayer: Phaser.GameObjects.Graphics;
  private outfitLayer: Phaser.GameObjects.Graphics;
  private headLayer: Phaser.GameObjects.Graphics;
  private hatLayer: Phaser.GameObjects.Graphics;
  private look: PlayerLook;
  private walkTime = 0;
  private image: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, look: PlayerLook = DEFAULT_LOOK, options: CharacterOptions = {}) {
    super(scene, x, y);
    this.look = { ...look };
    if (options.marker) {
      const ring = scene.add.graphics();
      ring.fillStyle(0xff3fa4, 0.3).fillCircle(0, 2, 21);
      ring.lineStyle(2.5, 0xffffff, 0.9).strokeCircle(0, 2, 21);
      this.add(ring);
    }
    this.bodyLayer = scene.make.graphics({}, false);
    this.outfitLayer = scene.make.graphics({}, false);
    this.headLayer = scene.make.graphics({}, false);
    this.hatLayer = scene.make.graphics({}, false);
    this.redrawBody();
    this.redrawOutfit();
    this.redrawHat();
    if (options.baked) {
      // Created after the layers are drawn, so the first bake sees every layer.
      this.image = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setScale(1 / BAKE_RES);
      this.add(this.image);
      this.bake();
    } else {
      this.add([this.bodyLayer, this.outfitLayer, this.headLayer, this.hatLayer]);
    }
    this.setScale(CHARACTER_SCALE);
    scene.add.existing(this);
  }

  getLook(): PlayerLook {
    return { ...this.look };
  }

  setBodyStyle(id: PlayerLook['body']): this {
    this.look.body = id;
    this.redrawBody();
    return this;
  }

  setOutfit(id: PlayerLook['outfit']): this {
    this.look.outfit = id;
    this.redrawOutfit();
    return this;
  }

  setHat(id: PlayerLook['hat']): this {
    this.look.hat = id;
    this.redrawHat();
    return this;
  }

  /** Turn to face a movement direction (unless turn is false) and swing the hands while walking. */
  updateMotion(dx: number, dy: number, deltaMs: number, turn = true): void {
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      if (turn) this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      this.walkTime += deltaMs;
    } else {
      this.walkTime = 0;
    }
    if (this.image) return;
    const swing = moving ? Math.sin(this.walkTime / 90) * 4 : 0;
    this.drawHands(swing);
  }

  private redrawBody(): void {
    this.drawHands(0);
    const skin = BODIES[this.look.body].skin;
    this.headLayer.clear();
    this.headLayer.fillStyle(skin, 1);
    this.headLayer.fillCircle(0, 0, 8);
    this.headLayer.lineStyle(1.5, 0x000000, 0.35);
    this.headLayer.strokeCircle(0, 0, 8);
    this.bake();
  }

  private drawHands(swing: number): void {
    const skin = BODIES[this.look.body].skin;
    const g = this.bodyLayer;
    g.clear();
    g.fillStyle(skin, 1);
    g.fillCircle(-15, 2 - swing, 4.5);
    g.fillCircle(15, 2 + swing, 4.5);
  }

  private redrawOutfit(): void {
    this.outfitLayer.clear();
    OUTFITS[this.look.outfit].draw(this.outfitLayer);
    this.bake();
  }

  private redrawHat(): void {
    this.hatLayer.clear();
    HATS[this.look.hat].draw(this.hatLayer);
    this.bake();
  }

  /** For baked characters: point the image at the texture for the current look, rendering it once if new. */
  private bake(): void {
    if (!this.image) return;
    const key = `character:${String(this.look.body)}:${String(this.look.outfit)}:${String(this.look.hat)}`;
    const textures = this.scene.textures;
    if (!textures.exists(key)) {
      const dt = textures.addDynamicTexture(key, BAKE_SIZE, BAKE_SIZE)!;
      const layers = [this.bodyLayer, this.outfitLayer, this.headLayer, this.hatLayer];
      for (const g of layers) g.setScale(BAKE_RES);
      dt.draw(layers, BAKE_SIZE / 2, BAKE_SIZE / 2).render();
      for (const g of layers) g.setScale(1);
    }
    this.image.setTexture(key);
  }
}
