import Phaser from 'phaser';

/**
 * A fill bar made of two tinted white images (a dark backing and the fill),
 * positioned and scaled instead of redrawn as Graphics every frame.
 */
export class Bar {
  private back: Phaser.GameObjects.Image;
  private fill: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, depth: number, fixed = false, backAlpha = 0.6) {
    this.back = scene.add.image(0, 0, '__WHITE').setOrigin(0).setTint(0x000000).setAlpha(backAlpha).setDepth(depth).setVisible(false);
    this.fill = scene.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(depth).setVisible(false);
    if (fixed) {
      this.back.setScrollFactor(0);
      this.fill.setScrollFactor(0);
    }
  }

  get objects(): Phaser.GameObjects.Image[] {
    return [this.back, this.fill];
  }

  /** Backing `pad` units wider than the fill on every side but the top and left of the fill box. */
  place(x: number, y: number, width: number, height: number, pad: number, value: number, color: number): void {
    this.back.setPosition(x - pad, y - pad).setDisplaySize(width + pad * 2, height + pad * 2).setVisible(true);
    const w = width * value;
    this.fill.setPosition(x, y).setDisplaySize(Math.max(w, 0.001), height).setTint(color).setVisible(w > 0);
  }

  hide(): void {
    this.back.setVisible(false);
    this.fill.setVisible(false);
  }
}
