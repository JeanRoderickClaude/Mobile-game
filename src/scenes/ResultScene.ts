import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { formatTime } from './GameScene';

export interface ResultData {
  outcome: 'caught' | 'complete';
  elapsedMs: number;
  levelIndex: number;
  hasNextLevel: boolean;
}

/** Overlay shown on top of the paused GameScene. */
export class ResultScene extends Phaser.Scene {
  constructor() {
    super('result');
  }

  create(data: ResultData): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const caught = data.outcome === 'caught';

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    this.add.rectangle(cx, cy, 420, 340, caught ? 0x7a1f1f : 0x1f6b3a, 0.95).setStrokeStyle(4, 0xffffff, 0.8);

    const font = 'Arial Black, Arial, sans-serif';
    this.add.text(cx, cy - 100, caught ? 'Caught' : 'Route complete', { fontFamily: font, fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
    this.add
      .text(cx, cy - 30, caught ? 'The police spotted you.' : `Time: ${formatTime(data.elapsedMs)}`, {
        fontFamily: 'Arial, sans-serif',
        fontSize: '28px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const restart = () => this.restart(data.levelIndex);
    this.makeButton(cx, cy + 70, 'Restart', restart);
    if (!caught && data.hasNextLevel) this.makeButton(cx, cy + 140, 'Next level', () => this.restart(data.levelIndex + 1));

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', restart);
    kb.once('keydown-SPACE', restart);
    kb.once('keydown-R', restart);
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 240, 60, 0xffffff, 1).setStrokeStyle(3, 0x000000, 0.4).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '26px', color: '#1d1f2b' }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(0xf2c94c));
    bg.on('pointerout', () => bg.setFillStyle(0xffffff));
    bg.on('pointerup', onClick);
  }

  private restart(levelIndex: number): void {
    this.scene.start('game', { levelIndex });
  }
}
