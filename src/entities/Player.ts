import Phaser from 'phaser';
import { CHARACTER_SCALE } from '../config';
import { BODIES, DEFAULT_LOOK, HATS, OUTFITS, type PlayerLook } from './cosmetics';

/**
 * The protestor. Drawn from stacked layers so each can be swapped on its own:
 *   body  - hands and skin tone (also used for the head)
 *   outfit - shirt, hoodie, coat
 *   head  - drawn from the body's skin tone, above the outfit
 *   hat   - topmost layer
 * Movement and collision live in GameScene; this class only handles looks
 * and facing.
 */
export class Player extends Phaser.GameObjects.Container {
  private bodyLayer: Phaser.GameObjects.Graphics;
  private outfitLayer: Phaser.GameObjects.Graphics;
  private headLayer: Phaser.GameObjects.Graphics;
  private hatLayer: Phaser.GameObjects.Graphics;
  private look: PlayerLook;
  private walkTime = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, look: PlayerLook = DEFAULT_LOOK) {
    super(scene, x, y);
    this.look = { ...look };
    this.bodyLayer = scene.add.graphics();
    this.outfitLayer = scene.add.graphics();
    this.headLayer = scene.add.graphics();
    this.hatLayer = scene.add.graphics();
    this.add([this.bodyLayer, this.outfitLayer, this.headLayer, this.hatLayer]);
    this.redrawBody();
    this.redrawOutfit();
    this.redrawHat();
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

  /** Turn to face a movement direction and swing the hands while walking. */
  updateMotion(dx: number, dy: number, deltaMs: number): void {
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      this.rotation = Math.atan2(dy, dx) + Math.PI / 2;
      this.walkTime += deltaMs;
    } else {
      this.walkTime = 0;
    }
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
  }

  private redrawHat(): void {
    this.hatLayer.clear();
    HATS[this.look.hat].draw(this.hatLayer);
  }
}
