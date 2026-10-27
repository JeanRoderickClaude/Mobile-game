import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { CAST, DIALOGUES, type CastMember, type DialogueLine, type PortraitShape } from '../story/story';
import { matches } from '../story/flags';
import { getFlags, setFlags } from '../systems/save';
import { FONT, FONT_BOLD, makeButton, type Button } from '../ui/widgets';

/** Where to go when the dialogue ends. */
export interface NextScene {
  key: string;
  data?: object;
  /** Launch on top of the scenes below (for overlays such as the result screen) instead of replacing them. */
  launch?: boolean;
}

export interface DialogueSceneData {
  dialogueId: string;
  then: NextScene;
  /** Drawn over a paused scene: dim it instead of covering it. */
  overlay?: boolean;
}

// Taps and keys are ignored this long after opening, so a finger lifted or
// a key held from the previous scene does not skip the first line.
const INPUT_DELAY_MS = 300;

const PANEL_TOP = 600;
const PORTRAIT_X = 95;
const PORTRAIT_Y = 690;
const TEXT_X = 175;

/**
 * Story dialogue: one line at a time with the speaker's name and a
 * placeholder portrait. Tap or Space advances. Skip ends the scene, but stops
 * at any choice still ahead so story flags are always set.
 */
export class DialogueScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private index = -1;
  private then!: NextScene;
  private openedAt = 0;
  private pressed = false; // a pointer went down inside this scene
  private portrait!: Phaser.GameObjects.Graphics;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private skip!: Button;
  private choiceButtons: Button[] = [];

  constructor() {
    super('dialogue');
  }

  create(data: DialogueSceneData): void {
    const dialogue = DIALOGUES[data.dialogueId];
    if (!dialogue) throw new Error(`No dialogue "${data.dialogueId}" in src/story/dialogue/`);
    this.lines = dialogue.lines;
    this.then = data.then;
    this.index = -1;
    this.pressed = false;
    this.choiceButtons = [];
    this.openedAt = this.time.now;

    const cx = GAME_WIDTH / 2;
    const bg = data.overlay
      ? this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      : this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.background, 1);
    bg.setInteractive();
    bg.on('pointerdown', () => (this.pressed = true));
    bg.on('pointerup', () => this.pressed && this.advance());
    if (!data.overlay) this.drawHarbor();

    this.add.rectangle(cx, PANEL_TOP + 170, GAME_WIDTH - 24, 340, 0x10121a, 0.94).setStrokeStyle(3, 0xffffff, 0.5);
    this.portrait = this.add.graphics();
    this.nameText = this.add.text(TEXT_X, PANEL_TOP + 28, '', { fontFamily: FONT_BOLD, fontSize: '26px', color: '#ffffff' });
    this.bodyText = this.add.text(TEXT_X, PANEL_TOP + 72, '', {
      fontFamily: FONT, fontSize: '25px', color: '#ffffff', lineSpacing: 6, wordWrap: { width: GAME_WIDTH - TEXT_X - 34 },
    });
    this.hint = this.add.text(GAME_WIDTH - 30, PANEL_TOP + 318, 'Tap to continue', { fontFamily: FONT, fontSize: '18px', color: '#b5b7c0' }).setOrigin(1, 0.5);
    this.skip = makeButton(this, GAME_WIDTH - 80, 45, 'Skip', () => this.skipAhead(), 120, 50);

    const kb = this.input.keyboard!;
    kb.on('keydown-SPACE', () => this.advance());
    kb.on('keydown-ENTER', () => this.advance());
    kb.on('keydown-ESC', () => this.skipAhead());
    kb.on('keydown', (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= this.choiceButtons.length) this.choose(n - 1);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const event of ['keydown-SPACE', 'keydown-ENTER', 'keydown-ESC', 'keydown']) kb.off(event);
    });

    this.show(0);
  }

  private ready(): boolean {
    return this.time.now - this.openedAt >= INPUT_DELAY_MS;
  }

  private get line(): DialogueLine | undefined {
    return this.lines[this.index];
  }

  private advance(): void {
    this.pressed = false;
    if (!this.ready() || this.line?.choices) return;
    this.show(this.index + 1);
  }

  /** Jumps to the next line with a choice, or ends the scene when there is none. */
  private skipAhead(): void {
    if (!this.ready() || this.line?.choices) return;
    const flags = getFlags();
    const next = this.lines.findIndex((l, i) => i > this.index && l.choices && matches(l.if, flags));
    this.show(next < 0 ? this.lines.length : next);
  }

  private choose(i: number): void {
    const choice = this.line?.choices?.[i];
    if (!choice || !this.ready()) return;
    setFlags(choice.set);
    this.show(this.index + 1);
  }

  private show(index: number): void {
    for (const b of this.choiceButtons) {
      b.bg.destroy();
      b.label.destroy();
    }
    this.choiceButtons = [];
    // Conditions are checked on arrival, so a choice can decide the lines after it.
    const flags = getFlags();
    while (index < this.lines.length && !matches(this.lines[index].if, flags)) index++;
    this.index = index;
    const line = this.line;
    if (!line) {
      this.finish();
      return;
    }
    const who = CAST[line.speaker];
    this.drawPortrait(who);
    this.nameText.setText(who.name);
    const narrated = who.shape === 'none';
    // The narrator has no portrait, so its text uses the full panel width.
    const x = narrated ? 40 : TEXT_X;
    this.bodyText
      .setX(x)
      .setY(narrated ? PANEL_TOP + 40 : PANEL_TOP + 72)
      .setWordWrapWidth(GAME_WIDTH - x - 34)
      .setFontStyle(narrated ? 'italic' : '')
      .setText(line.text);

    const choices = line.choices ?? [];
    this.hint.setVisible(choices.length === 0);
    this.skip.bg.setVisible(choices.length === 0);
    this.skip.label.setVisible(choices.length === 0);
    // Choices stack upward from just above the panel.
    choices.forEach((c, i) => {
      const y = PANEL_TOP - 50 - (choices.length - 1 - i) * 76;
      this.choiceButtons.push(makeButton(this, GAME_WIDTH / 2, y, `${i + 1}. ${c.text}`, () => this.choose(i), GAME_WIDTH - 60, 64));
    });
    for (const b of this.choiceButtons) b.label.setFontSize(22);
  }

  private finish(): void {
    const { key, data, launch } = this.then;
    if (launch) {
      this.scene.launch(key, data);
      this.scene.stop();
    } else {
      this.scene.start(key, data);
    }
  }

  private drawPortrait(who: CastMember): void {
    const g = this.portrait.clear();
    if (who.shape === 'none') return;
    const color = Phaser.Display.Color.HexStringToColor(who.color).color;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(PORTRAIT_X - 62, PORTRAIT_Y - 62, 124, 124, 12);
    g.fillStyle(color, 1).lineStyle(4, 0xffffff, 0.85);
    drawShape(g, who.shape, PORTRAIT_X, PORTRAIT_Y, 48);
  }

  /** A simple skyline and water line behind standalone scenes. */
  private drawHarbor(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2a3550, 1).fillRect(0, 0, GAME_WIDTH, PANEL_TOP);
    const roofs = [[0, 330, 90], [90, 260, 70], [160, 370, 110], [270, 300, 80], [350, 230, 95], [445, 340, 95]];
    g.fillStyle(0x1d2438, 1);
    for (const [x, top, w] of roofs) g.fillRect(x, top, w, PANEL_TOP - top);
    g.fillStyle(0xf2c94c, 0.5);
    for (const [x, top, w] of roofs) {
      for (let wy = top + 25; wy < PANEL_TOP - 60; wy += 45) g.fillRect(x + w / 2 - 8, wy, 16, 20);
    }
    g.fillStyle(0x23476b, 1).fillRect(0, PANEL_TOP - 50, GAME_WIDTH, 50);
  }
}

function drawShape(g: Phaser.GameObjects.Graphics, shape: PortraitShape, x: number, y: number, r: number): void {
  const poly = (n: number, start: number) => {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const a = start + (i / n) * Math.PI * 2;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    g.fillPoints(pts, true).strokePoints(pts, true);
  };
  switch (shape) {
    case 'circle':
      g.fillCircle(x, y, r).strokeCircle(x, y, r);
      break;
    case 'square':
      g.fillRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7).strokeRect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
      break;
    case 'diamond':
      poly(4, -Math.PI / 2);
      break;
    case 'triangle':
      poly(3, -Math.PI / 2);
      break;
    case 'hexagon':
      poly(6, 0);
      break;
    case 'none':
      break;
  }
}
