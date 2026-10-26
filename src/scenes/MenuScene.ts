import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { Character } from '../entities/Character';
import { equippedLook, getCoins } from '../systems/save';
import { CoinLabel, FONT, FONT_BOLD, makeButton } from '../ui/widgets';

/** First screen: title, coin balance, the current look, Play and Locker. */
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
    this.add.circle(cx, 470, 105, 0xffffff, 0.06);
    const preview = new Character(this, cx, 480, equippedLook()).setScale(3.4);
    this.tweens.add({ targets: preview, y: 470, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const balance = new CoinLabel(this, 0, 640, getCoins(), 36);
    balance.x = cx - balance.labelWidth / 2;

    const play = () => this.scene.start('game', { levelIndex: 0 });
    makeButton(this, cx, 740, 'Play', play, 280, 70);
    makeButton(this, cx, 830, 'Locker', () => this.scene.start('locker'), 280, 70);

    const kb = this.input.keyboard!;
    kb.once('keydown-ENTER', play);
    kb.once('keydown-SPACE', play);
    kb.once('keydown-L', () => this.scene.start('locker'));
  }
}
