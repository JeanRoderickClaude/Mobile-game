import Phaser from 'phaser';
import { GAME_WIDTH } from '../config';

const FONT = 'Arial, sans-serif';
const CARD_X = 30;
const CARD_W = GAME_WIDTH - 60;
const CARD_Y = 150; // below the timer and the noise meter
const PAD = 22;
const IGNORE_MS = 300; // a finger still down from the level must not close it at once
const AUTO_MS = 8000; // read it or not, play resumes

/**
 * A one-time Pip thought over a paused level: a dark card with a short bracketed line, closed by a tap, Space,
 * Enter or Escape (or after AUTO_MS). The scene owns the pause; this only draws and reports when it is closed.
 */
export class HintCard {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private closed = false;
  private readonly opened: number;
  private readonly onDown = () => this.tryClose();
  private readonly onKey = () => this.tryClose();

  constructor(private scene: Phaser.Scene, text: string, private onClose: () => void) {
    this.opened = scene.time.now;
    const body = scene.add
      .text(CARD_X + PAD, CARD_Y + PAD, text, { fontFamily: FONT, fontSize: '26px', color: '#ffffff', lineSpacing: 6, wordWrap: { width: CARD_W - PAD * 2, useAdvancedWrap: true } })
      .setScrollFactor(0).setDepth(121);
    const h = body.height + PAD * 2 + 30;
    const box = scene.add.graphics().setScrollFactor(0).setDepth(120);
    box.fillStyle(0x1d1f2b, 0.94).fillRoundedRect(CARD_X, CARD_Y, CARD_W, h, 14);
    box.lineStyle(3, 0xff7cc4, 0.95).strokeRoundedRect(CARD_X, CARD_Y, CARD_W, h, 14);
    const tap = scene.add
      .text(CARD_X + CARD_W - PAD, CARD_Y + h - 12, 'Tap to continue', { fontFamily: FONT, fontSize: '18px', color: '#b5b7c0' })
      .setOrigin(1, 1).setScrollFactor(0).setDepth(121);
    this.objects.push(box, body, tap);
    scene.input.on('pointerdown', this.onDown);
    scene.input.keyboard?.on('keydown-SPACE', this.onKey);
    scene.input.keyboard?.on('keydown-ENTER', this.onKey);
    scene.input.keyboard?.on('keydown-ESC', this.onKey);
    scene.time.delayedCall(AUTO_MS, () => this.close());
  }

  private tryClose(): void {
    if (this.scene.time.now - this.opened >= IGNORE_MS) this.close();
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.scene.input.off('pointerdown', this.onDown);
    this.scene.input.keyboard?.off('keydown-SPACE', this.onKey);
    this.scene.input.keyboard?.off('keydown-ENTER', this.onKey);
    this.scene.input.keyboard?.off('keydown-ESC', this.onKey);
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.onClose();
  }
}
