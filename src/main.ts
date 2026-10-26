import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from './config';
import { GameScene } from './scenes/GameScene';
import { LockerScene } from './scenes/LockerScene';
import { MenuScene } from './scenes/MenuScene';
import { ResultScene } from './scenes/ResultScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: COLORS.background,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Two touch points: one for the joystick, one spare (e.g. a button tap).
  input: { activePointers: 2 },
  // The first scene in the list starts on load.
  scene: [MenuScene, GameScene, ResultScene, LockerScene],
});

// Exposed in development only, for browser-console debugging and automated tests.
if (import.meta.env.DEV) (window as unknown as { game: Phaser.Game }).game = game;
