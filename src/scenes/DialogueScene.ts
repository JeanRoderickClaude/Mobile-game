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

// The panel sits on the bottom edge and grows upward to fit the line, so
// text keeps one size however long it is. Text spans the full panel width
// under the portrait row: about 34 characters per row at 26px.
const PANEL_X = 12;
const PANEL_W = GAME_WIDTH - 24;
const PANEL_BOTTOM = 948;
const PANEL_MIN_H = 300; // speech: portrait row plus three rows of text
const NARRATION_MIN_H = 200; // narration has no portrait row
const PANEL_MAX_TOP = 96; // never cover the Skip button
const PAD = 24;
const PORTRAIT = 84; // portrait box size
const TEXT_W = PANEL_W - PAD * 2;
const HINT_H = 40; // room under the text for "Tap to continue"
const HORIZON = 600; // bottom of the harbor backdrop

/**
 * Story dialogue: one line at a time with the speaker's name and a
 * placeholder portrait, or italic narration with neither. Tap or Space advances. Skip ends the scene, but stops
 * at any choice still ahead so story flags are always set.
 */
export class DialogueScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private index = -1;
  private then!: NextScene;
  private openedAt = 0;
  private pressed = false; // a pointer went down inside this scene
  private panel!: Phaser.GameObjects.Graphics;
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

    this.panel = this.add.graphics();
    this.portrait = this.add.graphics();
    this.nameText = this.add.text(0, 0, '', { fontFamily: FONT_BOLD, fontSize: '26px', color: '#ffffff' }).setOrigin(0, 0.5);
    this.bodyText = this.add.text(PANEL_X + PAD, 0, '', {
      fontFamily: FONT, fontSize: '26px', color: '#ffffff', lineSpacing: 8, wordWrap: { width: TEXT_W, useAdvancedWrap: true },
    });
    this.hint = this.add.text(PANEL_X + PANEL_W - PAD, PANEL_BOTTOM - HINT_H / 2 - 4, 'Tap to continue', { fontFamily: FONT, fontSize: '18px', color: '#b5b7c0' }).setOrigin(1, 0.5);
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
    // Narration has no speaker: no portrait or name, italic text from the top of the panel.
    const who = line.speaker !== undefined ? CAST[line.speaker] : undefined;
    this.bodyText.setFontStyle(who ? '' : 'italic').setText(line.text);
    const textOffset = who ? PAD + PORTRAIT + 14 : PAD + 4;
    const wanted = textOffset + this.bodyText.height + 12 + HINT_H;
    const top = Math.max(PANEL_MAX_TOP, PANEL_BOTTOM - Math.max(who ? PANEL_MIN_H : NARRATION_MIN_H, wanted));
    if (import.meta.env.DEV && PANEL_BOTTOM - top < wanted) console.warn(`Dialogue line ${this.index} is too long for the screen: ${line.text}`);
    this.panel.clear().fillStyle(0x10121a, 0.94).fillRect(PANEL_X, top, PANEL_W, PANEL_BOTTOM - top);
    this.panel.lineStyle(3, 0xffffff, 0.5).strokeRect(PANEL_X, top, PANEL_W, PANEL_BOTTOM - top);
    this.bodyText.setY(top + textOffset);
    this.drawPortrait(who, top);
    this.nameText.setText(who ? `${who.name}:` : '').setPosition(PANEL_X + PAD + PORTRAIT + 18, top + PAD + PORTRAIT / 2);

    const choices = line.choices ?? [];
    this.hint.setVisible(choices.length === 0);
    this.skip.bg.setVisible(choices.length === 0);
    this.skip.label.setVisible(choices.length === 0);
    // Choices stack upward from just above the panel.
    choices.forEach((c, i) => {
      const y = top - 50 - (choices.length - 1 - i) * 76;
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

  private drawPortrait(who: CastMember | undefined, top: number): void {
    const g = this.portrait.clear();
    if (!who) return;
    const x = PANEL_X + PAD;
    const y = top + PAD;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y, PORTRAIT, PORTRAIT, 10);
    g.fillStyle(Phaser.Display.Color.HexStringToColor(who.color).color, 1).lineStyle(3, 0xffffff, 0.85);
    drawShape(g, who.shape, x + PORTRAIT / 2, y + PORTRAIT / 2, PORTRAIT * 0.36);
  }

  /** A simple skyline and water line behind standalone scenes. */
  private drawHarbor(): void {
    const g = this.add.graphics();
    g.fillStyle(0x2a3550, 1).fillRect(0, 0, GAME_WIDTH, HORIZON);
    const roofs = [[0, 330, 90], [90, 260, 70], [160, 370, 110], [270, 300, 80], [350, 230, 95], [445, 340, 95]];
    g.fillStyle(0x1d2438, 1);
    for (const [x, top, w] of roofs) g.fillRect(x, top, w, HORIZON - top);
    g.fillStyle(0xf2c94c, 0.5);
    for (const [x, top, w] of roofs) {
      for (let wy = top + 25; wy < HORIZON - 60; wy += 45) g.fillRect(x + w / 2 - 8, wy, 16, 20);
    }
    g.fillStyle(0x23476b, 1).fillRect(0, HORIZON - 50, GAME_WIDTH, GAME_HEIGHT - HORIZON + 50);
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
  }
}
