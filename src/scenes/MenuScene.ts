import Phaser from 'phaser';
import { COLORS, DIFFICULTIES, GAME_WIDTH, type Difficulty } from '../config';
import { Character } from '../entities/Character';
import { PRACTICE_LEVEL_INDEX } from '../levels';
import { equippedLook, getCoins, getDifficulty, getShowFps, setDifficulty, setShowFps } from '../systems/save';
import { CoinLabel, FONT, FONT_BOLD, makeButton } from '../ui/widgets';

/** First screen: title, coin balance, the current look, Play (the chapter map), Locker and the difficulty choice. */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super('menu');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);

    this.add.text(cx, 150, 'PROTEST', { fontFamily: FONT_BOLD, fontSize: '64px', color: '#ff3fa4', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(cx, 220, 'ROUTE', { fontFamily: FONT_BOLD, fontSize: '64px', color: '#ffffff', stroke: '#000', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(cx, 280, 'Reach the finish. Avoid the police.', { fontFamily: FONT, fontSize: '22px', color: '#b5b7c0' }).setOrigin(0.5);

    // The player as they will look in a run.
    this.add.circle(cx, 445, 100, 0xffffff, 0.06);
    const preview = new Character(this, cx, 455, equippedLook()).setScale(3.4);
    this.tweens.add({ targets: preview, y: 445, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const balance = new CoinLabel(this, 0, 600, getCoins(), 36);
    balance.x = cx - balance.labelWidth / 2;

    const play = () => this.scene.start('chapters');
    makeButton(this, cx, 685, 'Play', play, 280, 70);
    makeButton(this, cx, 770, 'Locker', () => this.scene.start('locker'), 280, 70);
    this.buildDifficultyPicker(cx, 880);
    this.buildFpsToggle(36);
    // A practice level for the chase and search system; hidden by the build setting VITE_PRACTICE_LEVEL=off.
    if (PRACTICE_LEVEL_INDEX >= 0) {
      makeButton(this, GAME_WIDTH - 72, 36, 'Practice', () => this.scene.start('game', { levelIndex: PRACTICE_LEVEL_INDEX }), 124, 44);
    }

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', play);
    kb.once('keydown-SPACE', play);
    kb.once('keydown-L', () => this.scene.start('locker'));
  }

  /** A small "Show FPS" switch in the top left. The choice is saved at once and read by the game scene. */
  private buildFpsToggle(y: number): void {
    const x = 84;
    const bg = this.add.rectangle(x, y, 140, 44, 0x34374a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive({ useHandCursor: true });
    const label = this.add.text(x, y, '', { fontFamily: FONT_BOLD, fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    const refresh = () => {
      const on = getShowFps();
      bg.setFillStyle(on ? 0xf2c94c : 0x34374a);
      label.setText(`Show FPS: ${on ? 'On' : 'Off'}`).setColor(on ? '#1d1f2b' : '#ffffff');
    };
    bg.on('pointerup', () => {
      setShowFps(!getShowFps());
      refresh();
    });
    refresh();
  }

  /** Segmented Relaxed / Normal switch with a line explaining them. The choice is saved at once. */
  private buildDifficultyPicker(cx: number, y: number): void {
    this.add.text(cx, y - 46, 'Difficulty', { fontFamily: FONT, fontSize: '20px', color: '#b5b7c0' }).setOrigin(0.5);
    const keys = Object.keys(DIFFICULTIES) as Difficulty[];
    const width = 140;
    const parts = keys.map((key, i) => {
      const x = cx + (i - (keys.length - 1) / 2) * width;
      const bg = this.add.rectangle(x, y, width - 6, 52, 0x34374a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, y, DIFFICULTIES[key].label, { fontFamily: FONT_BOLD, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
      bg.on('pointerup', () => {
        setDifficulty(key);
        refresh();
      });
      return { key, bg, label };
    });
    const refresh = () => {
      for (const p of parts) {
        const on = p.key === getDifficulty();
        p.bg.setFillStyle(on ? 0xf2c94c : 0x34374a);
        p.label.setColor(on ? '#1d1f2b' : '#ffffff');
      }
    };
    refresh();
    const note = { fontFamily: FONT, fontSize: '18px', color: '#b5b7c0', align: 'center' };
    this.add.text(cx, y + 52, 'Normal is the intended experience.\nRelaxed is more forgiving.', note).setOrigin(0.5);
  }
}
