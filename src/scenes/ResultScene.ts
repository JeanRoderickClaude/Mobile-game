import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CoinLabel, FONT, FONT_BOLD, makeButton } from '../ui/widgets';
import { startChapter } from '../story/story';
import { formatTime, type GameSceneData } from './GameScene';

export interface ResultData {
  outcome: 'caught' | 'complete';
  elapsedMs: number;
  /** Coins picked up during the run: paid out when complete, lost when caught. */
  coins: number;
  /** Speed bonus paid on top of the coins (0 when caught). */
  bonus: number;
  /** Saved balance after the payout. */
  balance: number;
  levelIndex: number;
  hasNextLevel: boolean;
  /** Set when the run was a story chapter: buttons lead through chapters instead of levels. */
  chapterIndex?: number;
  hasNextChapter: boolean;
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
    const story = data.chapterIndex !== undefined;
    const next = !caught && (story ? data.hasNextChapter : data.hasNextLevel);
    const buttons = 2 + (next ? 1 : 0);
    const panelH = (caught ? 260 : 400) + buttons * 70;
    const top = cy - panelH / 2;

    this.add.rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    this.add.rectangle(cx, cy, 440, panelH, caught ? 0x7a1f1f : 0x1f6b3a, 0.95).setStrokeStyle(4, 0xffffff, 0.8);

    this.add.text(cx, top + 55, caught ? 'Caught' : 'Route complete', { fontFamily: FONT_BOLD, fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
    const body = { fontFamily: FONT, fontSize: '26px', color: '#ffffff' };
    let y: number;
    if (caught) {
      this.add.text(cx, top + 120, 'The police spotted you.', body).setOrigin(0.5);
      const lost = data.coins > 0 ? `You lost ${data.coins} coin${data.coins === 1 ? '' : 's'}.` : 'You had no coins to lose.';
      this.add.text(cx, top + 165, lost, { ...body, color: data.coins > 0 ? '#ffd0d0' : '#ffffff' }).setOrigin(0.5);
      y = top + 260;
    } else {
      this.add.text(cx, top + 115, `Time: ${formatTime(data.elapsedMs)}`, body).setOrigin(0.5);
      const row = (ry: number, label: string, value: string, bold = false) => {
        const style = { ...body, fontFamily: bold ? FONT_BOLD : FONT };
        this.add.text(cx - 170, ry, label, style).setOrigin(0, 0.5);
        this.add.text(cx + 170, ry, value, style).setOrigin(1, 0.5);
      };
      row(top + 175, 'Coins collected', `+${data.coins}`);
      row(top + 215, 'Speed bonus', `+${data.bonus}`);
      this.add.rectangle(cx, top + 243, 340, 2, 0xffffff, 0.7);
      row(top + 272, 'Earned', `+${data.coins + data.bonus}`, true);
      this.add.text(cx - 170, top + 330, 'Balance', body).setOrigin(0, 0.5);
      const balance = new CoinLabel(this, 0, top + 330, data.balance);
      balance.x = cx + 170 - balance.labelWidth;
      y = top + 400;
    }

    // Restarting a chapter skips its intro; "Next chapter" plays the next intro.
    const restart = () => this.restart({ levelIndex: data.levelIndex, chapterIndex: data.chapterIndex });
    makeButton(this, cx, y, caught ? 'Try again' : story ? 'Replay' : 'Restart', restart);
    if (next && story) makeButton(this, cx, (y += 70), 'Next chapter', () => this.nextChapter(data.chapterIndex! + 1));
    else if (next) makeButton(this, cx, (y += 70), 'Next level', () => this.restart({ levelIndex: data.levelIndex + 1 }));
    makeButton(this, cx, y + 70, story ? 'Chapters' : 'Menu', () => this.leave(story ? 'chapters' : 'menu'));

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', restart);
    kb.once('keydown-SPACE', restart);
    kb.once('keydown-R', restart);
    kb.once('keydown-ESC', () => this.leave(story ? 'chapters' : 'menu'));
  }

  private restart(data: GameSceneData): void {
    this.scene.start('game', data);
  }

  private nextChapter(index: number): void {
    this.scene.stop('game');
    startChapter(this, index);
  }

  private leave(key: 'menu' | 'chapters'): void {
    this.scene.stop('game');
    this.scene.start(key);
  }
}
