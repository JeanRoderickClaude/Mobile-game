import Phaser from 'phaser';
import { CHARACTER_SCALE } from '../config';
import { BODIES, DEFAULT_LOOK, FRONT, HAIR_COLORS, HAIRSTYLES, HATS, OUTFITS, SIGNS, type PlayerLook } from './cosmetics';
import { INK, inkify } from './ink';

/**
 * A protestor: the player or a crowd member. Drawn from stacked layers so each
 * can be swapped on its own:
 *   body  - hands and skin tone (also used for the head)
 *   outfit - shirt, hoodie, coat
 *   sign  - a carried sign or flag, held out ahead of the player
 *   head  - drawn from the body's skin tone, above the outfit
 *   hair  - between the head and the hat, so a hat hides the hair under it
 *   hat   - topmost layer
 * Every layer is inked (see ink.ts): thick dark outlines and one shade tone. The head and everything on it
 * (hair, hat) is drawn HEAD_SCALE times larger than the art is authored, for a big-headed comic look.
 * The player also gets a marker ring underneath so they stand out in a crowd.
 * Crowd members are "baked": the layers are rendered once into a texture shared
 * by every character with the same look, and shown as one image. That keeps
 * 30+ protestors cheap to draw, at the cost of the hand swing animation.
 * Movement lives in GameScene (player) and Crowd (others); this class only
 * handles looks and facing.
 *
 * The front view (dialogue stage, locker preview) has the same layers drawn
 * full body facing the viewer, with the feet at (0, 0). Its layer order puts
 * the sign at the back so the hand holds the stick in front of it.
 */
export interface CharacterOptions {
  /** Draw the player's marker ring underneath. */
  marker?: boolean;
  /** Render as one cached image instead of live layers. Top-down only. */
  baked?: boolean;
  /** "top" (default) for the game, "front" for full body facing the viewer. */
  view?: 'top' | 'front';
}

const OUTLINE_TOP = 1.25; // outline thickness in authored units, top-down
const OUTLINE_FRONT = 1.5; // front view is drawn about 2.7 times larger on the stage
const HEAD_SCALE_TOP = 1.25; // the head, hair and hat grow about the middle of the head
const HEAD_SCALE_FRONT = 1.3; // ...about the neck, so the chin stays put and the head grows up and out
const NECK_Y = -46;

const BAKE_RES = 2; // baked textures are drawn at this multiple for sharpness
const BAKE_SIZE = 64 * BAKE_RES; // covers local space -32..32, enough for a sign

export class Character extends Phaser.GameObjects.Container {
  private bodyLayer: Phaser.GameObjects.Graphics;
  private outfitLayer: Phaser.GameObjects.Graphics;
  private signLayer: Phaser.GameObjects.Graphics;
  private headLayer: Phaser.GameObjects.Graphics;
  private hairBackLayer: Phaser.GameObjects.Graphics;
  private hairLayer: Phaser.GameObjects.Graphics;
  private hatLayer: Phaser.GameObjects.Graphics;
  private look: PlayerLook;
  private front: boolean;
  private walkTime = 0;
  private image: Phaser.GameObjects.Image | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number, look: PlayerLook = DEFAULT_LOOK, options: CharacterOptions = {}) {
    super(scene, x, y);
    this.look = { ...look };
    this.front = options.view === 'front';
    if (options.marker && !this.front) {
      const ring = scene.add.graphics();
      ring.fillStyle(0xff3fa4, 0.3).fillCircle(0, 2, 21);
      ring.lineStyle(2.5, 0xffffff, 0.9).strokeCircle(0, 2, 21);
      this.add(ring);
    }
    const width = this.front ? OUTLINE_FRONT : OUTLINE_TOP;
    const layer = () => inkify(scene.make.graphics({}, false), width);
    this.bodyLayer = layer();
    this.outfitLayer = layer();
    this.signLayer = layer();
    this.headLayer = layer();
    this.hairBackLayer = layer();
    this.hairLayer = layer();
    this.hatLayer = layer();
    // The head, its hair and the hat share one transform.
    const s = this.front ? HEAD_SCALE_FRONT : HEAD_SCALE_TOP;
    const pivotY = this.front ? NECK_Y : 0;
    for (const g of [this.headLayer, this.hairBackLayer, this.hairLayer, this.hatLayer]) g.setScale(s).setPosition(0, pivotY * (1 - s));
    this.redrawBody();
    this.redrawOutfit();
    this.redrawSign();
    this.redrawHair();
    this.redrawHat();
    if (this.front) {
      this.add([this.signLayer, this.bodyLayer, this.outfitLayer, this.hairBackLayer, this.headLayer, this.hairLayer, this.hatLayer]);
    } else if (options.baked) {
      // Created after the layers are drawn, so the first bake sees every layer.
      this.image = new Phaser.GameObjects.Image(scene, 0, 0, '__DEFAULT').setScale(1 / BAKE_RES);
      this.add(this.image);
      this.bake();
    } else {
      this.add([this.bodyLayer, this.outfitLayer, this.signLayer, this.headLayer, this.hairLayer, this.hatLayer]);
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

  setSign(id: PlayerLook['sign']): this {
    this.look.sign = id;
    this.redrawSign();
    return this;
  }

  setHair(id: PlayerLook['hair']): this {
    this.look.hair = id;
    this.redrawHair();
    return this;
  }

  setHairColor(id: PlayerLook['hairColor']): this {
    this.look.hairColor = id;
    this.redrawHair();
    return this;
  }

  /** Swap every layer to match a look. */
  setLook(look: PlayerLook): this {
    return this.setBodyStyle(look.body).setOutfit(look.outfit).setSign(look.sign).setHat(look.hat).setHair(look.hair).setHairColor(look.hairColor);
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
    if (this.image || this.front) return;
    const swing = moving ? Math.sin(this.walkTime / 90) * 4 : 0;
    this.drawHands(swing);
  }

  private redrawBody(): void {
    this.drawHands(0);
    const skin = BODIES[this.look.body].skin;
    const h = this.headLayer.clear();
    if (this.front) {
      const { headY: y, headR: r } = FRONT;
      h.fillStyle(skin, 1).fillRect(-3.5, y + r - 3, 7, 7); // neck
      h.fillStyle(skin, 1).fillCircle(0, y, r);
      // A cheerful face: wide eyes with a glint, rosy cheeks and a big smile.
      h.fillStyle(0x1d1f2b, 1).fillEllipse(-3.4, y + 0.2, 2.8, 3.6).fillEllipse(3.4, y + 0.2, 2.8, 3.6);
      h.fillStyle(0xffffff, 1).fillCircle(-3.9, y - 0.6, 0.8).fillCircle(2.9, y - 0.6, 0.8);
      h.fillStyle(0xff6f8f, 0.55).fillCircle(-6.2, y + 3.4, 1.9).fillCircle(6.2, y + 3.4, 1.9);
      h.lineStyle(1.3, INK, 1).beginPath().arc(0, y + 2.6, 3.4, 0.25, Math.PI - 0.25, false).strokePath();
    } else {
      h.fillStyle(skin, 1);
      h.fillCircle(0, 0, 8);
    }
    this.bake();
  }

  private drawHands(swing: number): void {
    const skin = BODIES[this.look.body].skin;
    const g = this.bodyLayer;
    if (this.front) {
      // Trousers, shoes and hands. The outfit draws the sleeves over the top.
      g.clear();
      g.fillStyle(0x2b2d42, 1).fillRect(-9, -21, 8, 19).fillRect(1, -21, 8, 19);
      g.fillStyle(0x1a1a1a, 1).fillEllipse(-5, -1.5, 11, 5).fillEllipse(5, -1.5, 11, 5);
      g.fillStyle(skin, 1).fillCircle(-FRONT.handX, FRONT.handY, 3.6).fillCircle(FRONT.handX, FRONT.handY, 3.6);
      return;
    }
    g.clear();
    g.fillStyle(skin, 1);
    g.fillCircle(-15, 2 - swing, 5);
    g.fillCircle(15, 2 + swing, 5);
  }

  private redrawOutfit(): void {
    this.outfitLayer.clear();
    const style = OUTFITS[this.look.outfit];
    (this.front ? style.front : style.draw)(this.outfitLayer);
    this.bake();
  }

  private redrawSign(): void {
    this.signLayer.clear();
    const style = SIGNS[this.look.sign];
    (this.front ? style.front : style.draw)(this.signLayer);
    this.bake();
  }

  private redrawHair(): void {
    const style = HAIRSTYLES[this.look.hair];
    const color = HAIR_COLORS[this.look.hairColor];
    this.hairLayer.clear();
    this.hairBackLayer.clear();
    if (this.front) {
      style.back(this.hairBackLayer, color);
      style.front(this.hairLayer, color);
    } else {
      style.draw(this.hairLayer, color);
    }
    this.bake();
  }

  private redrawHat(): void {
    this.hatLayer.clear();
    const style = HATS[this.look.hat];
    (this.front ? style.front : style.draw)(this.hatLayer);
    this.bake();
  }

  /** For baked characters: point the image at the texture for the current look, rendering it once if new. */
  private bake(): void {
    if (!this.image) return;
    const { body, outfit, sign, hat, hair, hairColor } = this.look;
    const key = `character:${String(body)}:${String(outfit)}:${String(sign)}:${String(hat)}:${String(hair)}:${String(hairColor)}`;
    const textures = this.scene.textures;
    if (!textures.exists(key)) {
      const dt = textures.addDynamicTexture(key, BAKE_SIZE, BAKE_SIZE)!;
      const layers = [this.bodyLayer, this.outfitLayer, this.signLayer, this.headLayer, this.hairLayer, this.hatLayer];
      const base = new Map(layers.map((g) => [g, g.scaleX] as const));
      for (const g of layers) g.setScale(base.get(g)! * BAKE_RES);
      dt.draw(layers, BAKE_SIZE / 2, BAKE_SIZE / 2).render();
      for (const g of layers) g.setScale(base.get(g)!);
    }
    this.image.setTexture(key);
  }
}
