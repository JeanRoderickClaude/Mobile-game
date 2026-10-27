import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { CHAPTERS, chapterState, isPlayable, startChapter } from '../story/story';
import { getCoins } from '../systems/save';
import { CoinLabel, FONT, FONT_BOLD, makeButton } from '../ui/widgets';

const ROW_TOP = 150;
const ROW_H = 96;

/**
 * The chapter list, opened from Play. Finished chapters can be replayed for
 * coins, the next one is open, later ones are locked. A chapter without a
 * level yet shows "Coming soon" once it opens.
 */
export class ChapterMapScene extends Phaser.Scene {
  constructor() {
    super('chapters');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);
    makeButton(this, 80, 45, 'Back', () => this.scene.start('menu'), 120, 50);
    this.add.text(cx, 45, 'Chapters', { fontFamily: FONT_BOLD, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    const balance = new CoinLabel(this, 0, 45, getCoins());
    balance.x = GAME_WIDTH - 20 - balance.labelWidth;
    this.add.text(cx, 100, 'Port Murmur', { fontFamily: FONT, fontSize: '20px', color: '#b5b7c0' }).setOrigin(0.5);

    CHAPTERS.forEach((chapter, i) => {
      const y = ROW_TOP + i * ROW_H + ROW_H / 2 - 8;
      const state = chapterState(i);
      const playable = isPlayable(i);
      const fill = state === 'locked' ? 0x26283a : playable ? 0x34374a : 0x2c2f40;
      const row = this.add.rectangle(cx, y, GAME_WIDTH - 40, ROW_H - 14, fill).setStrokeStyle(2, state === 'open' && playable ? 0xf2c94c : 0xffffff, state === 'locked' ? 0.1 : 0.3);
      const dim = state === 'locked' ? '#6b6e78' : '#ffffff';

      // Number badge.
      this.add.circle(64, y, 26, state === 'done' ? 0x3fae5a : state === 'open' ? 0xf2c94c : 0x44475a);
      this.add.text(64, y, String(i + 1), { fontFamily: FONT_BOLD, fontSize: '24px', color: state === 'locked' ? '#9a9caa' : '#1d1f2b' }).setOrigin(0.5);
      this.add.text(108, y, chapter.title, { fontFamily: FONT_BOLD, fontSize: '26px', color: dim }).setOrigin(0, 0.5);

      const status = state === 'locked' ? 'Locked' : !playable ? 'Coming soon' : state === 'done' ? 'Replay' : 'Play';
      const statusColor = state === 'locked' ? '#6b6e78' : !playable ? '#b5b7c0' : state === 'done' ? '#7be08f' : '#f2c94c';
      this.add.text(GAME_WIDTH - 40, y, status, { fontFamily: FONT_BOLD, fontSize: '20px', color: statusColor }).setOrigin(1, 0.5);
      if (state === 'locked') this.drawLock(GAME_WIDTH - 130, y);

      if (playable) {
        row.setInteractive({ useHandCursor: true });
        row.on('pointerover', () => row.setFillStyle(0x45495e));
        row.on('pointerout', () => row.setFillStyle(fill));
        row.on('pointerup', () => startChapter(this, i));
      }
    });

    const kb = this.input.keyboard!;
    // Enter plays the furthest open chapter that has a level.
    const next = CHAPTERS.map((_, i) => i).filter(isPlayable).pop();
    if (next !== undefined) kb.once('keydown-ENTER', () => startChapter(this, next));
    kb.once('keydown-ESC', () => this.scene.start('menu'));
  }

  private drawLock(x: number, y: number): void {
    const g = this.add.graphics();
    g.lineStyle(3, 0x6b6e78, 1).strokeCircle(x, y - 7, 7);
    g.fillStyle(0x6b6e78, 1).fillRoundedRect(x - 10, y - 4, 20, 16, 3);
  }
}
