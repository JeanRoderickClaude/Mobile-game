import Phaser from 'phaser';
import { COIN_VALUE } from '../config';
import type { CoinData } from '../levels/types';
import { drawCoin } from '../ui/widgets';

const COIN_RES = 2; // baked at twice the size for sharpness

/** The coin drawn once per kind into a texture, so a level's coins share one image each. */
function coinTexture(scene: Phaser.Scene, valuable: boolean): string {
  const key = `coin:${valuable ? 'big' : 'small'}`;
  if (scene.textures.exists(key)) return key;
  const r = valuable ? 13 : 9;
  const size = (r + 4) * 2 * COIN_RES;
  const g = scene.make.graphics({}, false);
  drawCoin(g, 0, 0, r, valuable);
  g.setScale(COIN_RES);
  const dt = scene.textures.addDynamicTexture(key, size, size)!;
  dt.draw(g, size / 2, size / 2).render();
  g.destroy();
  return key;
}

/** A coin on the street. Bobs gently until picked up. */
export class Coin {
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly valuable: boolean;
  collected = false;

  private sprite: Phaser.GameObjects.Image;

  constructor(private scene: Phaser.Scene, data: CoinData) {
    this.x = data.x;
    this.y = data.y;
    this.value = data.value ?? COIN_VALUE;
    this.valuable = this.value > COIN_VALUE;
    // Above the crowd (25) so coins inside a marching group stay visible, below the player (30).
    this.sprite = scene.add.image(this.x, this.y, coinTexture(scene, this.valuable)).setScale(1 / COIN_RES).setDepth(26);
    scene.tweens.add({
      targets: this.sprite, y: this.y - 3, duration: 700 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    if (this.valuable) {
      scene.tweens.add({ targets: this.sprite, scale: 1.15 / COIN_RES, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Marks the coin taken and plays the pickup animation: a pop, a rise and a floating "+value". */
  collect(): void {
    this.collected = true;
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    this.scene.tweens.add({
      targets: s, y: s.y - 26, scale: 1.7 / COIN_RES, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => s.destroy(),
    });
    const label = this.scene.add
      .text(this.x, this.y - 18, `+${this.value}`, {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: this.valuable ? '24px' : '18px',
        color: this.valuable ? '#5ce1e6' : '#f2c94c', stroke: '#000', strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(45);
    this.scene.tweens.add({ targets: label, y: label.y - 34, alpha: 0, duration: 700, ease: 'Quad.easeOut', onComplete: () => label.destroy() });
  }
}
