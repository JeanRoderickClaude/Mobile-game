import Phaser from 'phaser';
import { COLORS } from '../config';

export const FONT_BOLD = 'Arial Black, Arial, sans-serif';
export const FONT = 'Arial, sans-serif';

/** Draws a coin centred at (x, y) into g. */
export function drawCoin(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, valuable = false): void {
  const fill = valuable ? COLORS.coinValuable : COLORS.coin;
  const rim = valuable ? COLORS.coinValuableRim : COLORS.coinRim;
  g.fillStyle(0x000000, 0.25).fillCircle(x + 1.5, y + 2, r);
  g.fillStyle(rim, 1).fillCircle(x, y, r);
  g.fillStyle(fill, 1).fillCircle(x, y, r * 0.78);
  g.fillStyle(0xffffff, 0.55).fillCircle(x - r * 0.3, y - r * 0.3, r * 0.22);
  if (valuable) {
    // A star mark so valuable coins read differently at a glance, not just by colour.
    g.fillStyle(rim, 1);
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const d = (i % 2 ? 0.22 : 0.5) * r;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * d, y + Math.sin(a) * d));
    }
    g.fillPoints(pts, true);
  }
}

/** Coin icon followed by a number, left-aligned at (x, y) as its vertical centre. */
export class CoinLabel extends Phaser.GameObjects.Container {
  private text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, value: number, size = 26) {
    super(scene, x, y);
    const g = scene.add.graphics();
    drawCoin(g, size * 0.5, 0, size * 0.48);
    this.text = scene.add
      .text(size * 1.15, 0, String(value), { fontFamily: FONT_BOLD, fontSize: `${size}px`, color: COLORS.text, stroke: '#000', strokeThickness: 4 })
      .setOrigin(0, 0.5);
    this.add([g, this.text]);
    scene.add.existing(this);
  }

  setValue(value: number): this {
    this.text.setText(String(value));
    return this;
  }

  /** Width of icon plus number, for right-aligning. */
  get labelWidth(): number {
    return this.text.x + this.text.width;
  }
}

export interface Button {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setEnabled(enabled: boolean): void;
  setText(text: string): void;
}

/** A rounded-look rectangle button. Fires onClick on pointer up. */
export function makeButton(
  scene: Phaser.Scene, x: number, y: number, text: string, onClick: () => void, width = 240, height = 60,
): Button {
  const bg = scene.add.rectangle(x, y, width, height, 0xffffff, 1).setStrokeStyle(3, 0x000000, 0.4);
  const label = scene.add.text(x, y, text, { fontFamily: FONT_BOLD, fontSize: '26px', color: '#1d1f2b' }).setOrigin(0.5);
  let enabled = true;
  bg.setInteractive({ useHandCursor: true });
  bg.on('pointerover', () => enabled && bg.setFillStyle(0xf2c94c));
  bg.on('pointerout', () => enabled && bg.setFillStyle(0xffffff));
  bg.on('pointerup', () => enabled && onClick());
  return {
    bg,
    label,
    setEnabled(on: boolean) {
      enabled = on;
      bg.setFillStyle(on ? 0xffffff : 0x6b6e78);
      label.setColor(on ? '#1d1f2b' : '#b5b7c0');
      if (bg.input) bg.input.cursor = on ? 'pointer' : 'default';
    },
    setText(t: string) {
      label.setText(t);
    },
  };
}
