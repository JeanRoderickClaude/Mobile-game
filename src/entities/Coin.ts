import Phaser from 'phaser';
import { COIN_VALUE } from '../config';
import type { CoinData } from '../levels/types';
import { drawCoin } from '../ui/widgets';

/** A coin on the street. Bobs gently until picked up. */
export class Coin {
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly valuable: boolean;
  collected = false;

  private sprite: Phaser.GameObjects.Container;

  constructor(private scene: Phaser.Scene, data: CoinData) {
    this.x = data.x;
    this.y = data.y;
    this.value = data.value ?? COIN_VALUE;
    this.valuable = this.value > COIN_VALUE;
    const g = scene.add.graphics();
    drawCoin(g, 0, 0, this.valuable ? 13 : 9, this.valuable);
    // Above the crowd (25) so coins inside a marching group stay visible, below the player (30).
    this.sprite = scene.add.container(this.x, this.y, [g]).setDepth(26);
    scene.tweens.add({
      targets: this.sprite, y: this.y - 3, duration: 700 + Math.random() * 200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    if (this.valuable) {
      scene.tweens.add({ targets: this.sprite, scale: 1.15, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** Marks the coin taken and plays the pickup animation: a pop, a rise and a floating "+value". */
  collect(): void {
    this.collected = true;
    const s = this.sprite;
    this.scene.tweens.killTweensOf(s);
    this.scene.tweens.add({
      targets: s, y: s.y - 26, scale: 1.7, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => s.destroy(),
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
