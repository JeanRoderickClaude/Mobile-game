import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { noirMatrix } from '../systems/noir';
import { Character } from '../entities/Character';
import { matches } from '../story/flags';
import { backdropKey, backdropUrl } from '../story/backdrops';
import { CAST, DIALOGUES, PLAYER_CAST_ID, castLook, type DialogueLine, type StageName, type Tone } from '../story/story';
import { equippedLook, getFlags, setFlags } from '../systems/save';
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
  /** Drawn over a paused scene: dim the part below the stage instead of covering it. */
  overlay?: boolean;
}

// Taps and keys are ignored this long after opening, so a finger lifted or
// a key held from the previous scene does not skip the first line.
const INPUT_DELAY_MS = 300;

// The top half is the stage: a background strip with the characters in
// front view, feet on FLOOR_Y. The dialogue box sits below it.
const STAGE_H = 480;
const FLOOR_Y = 452;
const STAGE_SCALE = 2.7;
const STEP_FORWARD = 16; // the speaker moves this far down (toward the viewer)...
const STEP_SCALE = 1.07; // ...and grows by this much
const DIM = 0.42; // brightness of everyone who is not speaking
const MOVE_MS = 450; // walking on or off
const SHADE_MAX = 0.5; // darkest point of the gradient at the foot of a painted backdrop

// The box keeps one height per scene, sized to its longest line, so it does
// not jump between lines. Text is 26px and wraps across the full box width:
// about 34 characters per row.
const BOX_X = 12;
const BOX_W = GAME_WIDTH - 24;
const BOX_TOP = STAGE_H + 16;
const BOX_MAX_BOTTOM = GAME_HEIGHT - 16;
const PAD = 22;
const NAME_H = 38; // name row above spoken lines
const HINT_H = 36; // room under the text for "Tap to continue"
const TEXT_W = BOX_W - PAD * 2;

interface Actor {
  character: Character;
  x: number;
  on: boolean;
  brightness: Phaser.Display.ColorMatrix | null;
}

/**
 * Story dialogue on a side-on stage. The scene's characters stand side by
 * side in front view; the speaker steps forward at full brightness while the
 * others dim, and narration dims everyone. Tap or Space advances. Skip ends
 * the scene, but stops at any choice still ahead so story flags are always set.
 */
export class DialogueScene extends Phaser.Scene {
  private lines: DialogueLine[] = [];
  private index = -1;
  private then!: NextScene;
  private openedAt = 0;
  private pressed = false; // a pointer went down inside this scene
  private actors = new Map<string, Actor>();
  private boxBottom = 0;
  private nameText!: Phaser.GameObjects.Text;
  private bodyText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private skip!: Button;
  private choiceButtons: Button[] = [];
  /** Backdrop tone: the filter that grays it, and how gray it is now (0 colour .. 1 gray). */
  private toneMatrix: Phaser.Display.ColorMatrix | null = null;
  private grayness = { value: 0 };

  private stage: StageName | null = null;

  constructor() {
    super('dialogue');
  }

  init(data: DialogueSceneData): void {
    this.stage = DIALOGUES[data.dialogueId]?.stage ?? null;
  }

  /** Loads the stage's painted backdrop if it is not loaded yet; if the file is missing the drawn backdrop is used. */
  preload(): void {
    if (!this.stage || this.textures.exists(backdropKey(this.stage))) return;
    this.load.image(backdropKey(this.stage), backdropUrl(this.stage));
  }

  create(data: DialogueSceneData): void {
    const dialogue = DIALOGUES[data.dialogueId];
    if (!dialogue) throw new Error(`No dialogue "${data.dialogueId}" in src/story/dialogue/`);
    this.lines = dialogue.lines;
    this.then = data.then;
    this.index = -1;
    this.pressed = false;
    this.choiceButtons = [];
    this.actors = new Map();
    this.openedAt = this.time.now;

    const cx = GAME_WIDTH / 2;
    const bg = data.overlay
      ? this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
      : this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, COLORS.background, 1);
    bg.setInteractive();
    bg.on('pointerdown', () => (this.pressed = true));
    bg.on('pointerup', () => this.pressed && this.advance());
    const backdrop = this.textures.exists(backdropKey(dialogue.stage)) ? paintedStage(this, dialogue.stage) : drawStage(this, dialogue.stage);
    this.toneMatrix = null;
    if (this.game.renderer.type === Phaser.WEBGL) {
      backdrop.enableFilters();
      this.toneMatrix = backdrop.filters!.internal.addColorMatrix().colorMatrix;
    }
    this.setTone(dialogue.tone ?? 'color', false);

    for (const place of dialogue.cast) {
      const look = place.id === PLAYER_CAST_ID ? equippedLook() : castLook(place.id);
      const character = new Character(this, place.x, FLOOR_Y, look, { view: 'front' }).setScale(STAGE_SCALE).setDepth(10);
      character.setVisible(!place.offstage);
      this.actors.set(place.id, { character, x: place.x, on: !place.offstage, brightness: this.addBrightness(character) });
    }

    this.nameText = this.add.text(BOX_X + PAD, 0, '', { fontFamily: FONT_BOLD, fontSize: '26px', color: '#ffffff' }).setDepth(20);
    this.bodyText = this.add
      .text(BOX_X + PAD, 0, '', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', lineSpacing: 8, wordWrap: { width: TEXT_W, useAdvancedWrap: true } })
      .setDepth(20);
    this.layoutBox();
    this.hint = this.add
      .text(BOX_X + BOX_W - PAD, this.boxBottom - HINT_H / 2 - 4, 'Tap to continue', { fontFamily: FONT, fontSize: '18px', color: '#b5b7c0' })
      .setOrigin(1, 0.5)
      .setDepth(20);
    this.skip = makeButton(this, GAME_WIDTH - 80, 45, 'Skip', () => this.skipAhead(), 120, 50);
    this.skip.bg.setDepth(30);
    this.skip.label.setDepth(30);

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

  /** A brightness filter for dimming, or null on the canvas renderer (which falls back to alpha). */
  private addBrightness(character: Character): Phaser.Display.ColorMatrix | null {
    if (this.game.renderer.type !== Phaser.WEBGL) return null;
    character.enableFilters();
    return character.filters!.internal.addColorMatrix().colorMatrix;
  }

  /** Measures every line once and draws the box at the height the longest one needs. */
  private layoutBox(): void {
    let tallest = 0;
    for (const line of this.lines) {
      this.bodyText.setFontStyle(line.speaker ? '' : 'italic').setText(line.text);
      tallest = Math.max(tallest, (line.speaker ? NAME_H : 0) + this.bodyText.height);
    }
    const wanted = BOX_TOP + PAD + tallest + 12 + HINT_H;
    if (import.meta.env.DEV && wanted > BOX_MAX_BOTTOM) console.warn('Dialogue: the longest line does not fit below the stage; shorten it.');
    this.boxBottom = Math.min(BOX_MAX_BOTTOM, wanted);
    const g = this.add.graphics().setDepth(19);
    g.fillStyle(0x10121a, 1).fillRect(BOX_X, BOX_TOP, BOX_W, this.boxBottom - BOX_TOP);
    g.lineStyle(3, 0xffffff, 0.5).strokeRect(BOX_X, BOX_TOP, BOX_W, this.boxBottom - BOX_TOP);
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
    // Lines skipped over still move people on and off, so a choice sees the right stage.
    for (let i = this.index + 1; i < (next < 0 ? this.lines.length : next); i++) {
      if (matches(this.lines[i].if, flags)) this.moveActors(this.lines[i], false);
    }
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

    this.moveActors(line, true);
    if (line.tone) this.setTone(line.tone, true);
    this.spotlight(line.speaker);

    // Narration has no speaker: no name, italic text from the top of the box.
    const who = line.speaker !== undefined ? CAST[line.speaker] : undefined;
    this.nameText.setText(who ? `${who.name}:` : '').setColor(who?.color ?? '#ffffff').setY(BOX_TOP + PAD);
    this.bodyText
      .setFontStyle(who ? '' : 'italic')
      .setText(line.text)
      .setY(BOX_TOP + PAD + (who ? NAME_H : 0));

    const choices = line.choices ?? [];
    this.hint.setVisible(choices.length === 0);
    this.skip.bg.setVisible(choices.length === 0);
    this.skip.label.setVisible(choices.length === 0);
    // Choices stack under the box, moved up if the box leaves too little room.
    const first = Math.min(this.boxBottom + 50, GAME_HEIGHT - 44 - (choices.length - 1) * 76);
    choices.forEach((c, i) => {
      const b = makeButton(this, GAME_WIDTH / 2, first + i * 76, `${i + 1}. ${c.text}`, () => this.choose(i), GAME_WIDTH - 60, 64);
      b.bg.setDepth(25);
      b.label.setDepth(25).setFontSize(22);
      this.choiceButtons.push(b);
    });
  }

  /** Grays or colours the backdrop (characters keep their colours). Fades unless animate is false. */
  private setTone(tone: Tone, animate: boolean): void {
    const target = tone === 'gray' ? 1 : 0;
    const apply = () => {
      const t = this.grayness.value;
      this.toneMatrix?.set(noirMatrix(t));
    };
    this.tweens.killTweensOf(this.grayness);
    if (!animate) {
      this.grayness.value = target;
      apply();
      return;
    }
    this.tweens.add({ targets: this.grayness, value: target, duration: 500, onUpdate: apply, onComplete: apply });
  }

  /** Applies a line's "exit" and "enter". Walks unless animate is false. */
  private moveActors(line: DialogueLine, animate: boolean): void {
    for (const id of line.exit ?? []) {
      const a = this.actors.get(id);
      if (!a?.on) continue;
      a.on = false;
      this.tweens.killTweensOf(a.character);
      if (!animate) {
        a.character.setVisible(false);
        continue;
      }
      this.tweens.add({ targets: a.character, x: offstageX(a.x), duration: MOVE_MS, ease: 'Sine.easeIn', onComplete: () => a.character.setVisible(false) });
    }
    for (const id of line.enter ?? []) {
      const a = this.actors.get(id);
      if (!a || a.on) continue;
      a.on = true;
      this.tweens.killTweensOf(a.character);
      a.character.setVisible(true).setX(animate ? offstageX(a.x) : a.x);
      if (animate) this.tweens.add({ targets: a.character, x: a.x, duration: MOVE_MS, ease: 'Sine.easeOut' });
    }
  }

  /** The speaker steps forward at full brightness; everyone else dims. No speaker on stage dims everyone. */
  private spotlight(speaker: string | undefined): void {
    for (const [id, a] of this.actors) {
      const lit = id === speaker && a.on;
      a.character.setDepth(lit ? 11 : 10);
      if (a.brightness) a.brightness.brightness(lit ? 1 : DIM);
      else a.character.setAlpha(lit ? 1 : 0.55);
      // Only y and scale here, so a walk-on tween on x keeps running.
      this.tweens.add({
        targets: a.character,
        y: FLOOR_Y + (lit ? STEP_FORWARD : 0),
        scale: STAGE_SCALE * (lit ? STEP_SCALE : 1),
        duration: 160,
        ease: 'Sine.easeOut',
      });
    }
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
}

/** Where a character walks on from and off to: the nearer side of the screen. */
function offstageX(x: number): number {
  return x < GAME_WIDTH / 2 ? -90 : GAME_WIDTH + 90;
}

/**
 * A painted backdrop: the image fills the stage strip, and a gradient darkens its bottom so the characters
 * (feet on FLOOR_Y) stand clearly against bright floors and reflections. In one container, like the drawn
 * backdrops, so the tone filter grays both the same way.
 */
function paintedStage(scene: Phaser.Scene, stage: StageName): Phaser.GameObjects.Container {
  const image = scene.add.image(0, 0, backdropKey(stage)).setOrigin(0).setDisplaySize(GAME_WIDTH, STAGE_H);
  const shade = scene.add.graphics();
  const from = 200;
  const steps = 28;
  for (let i = 0; i < steps; i++) {
    const t = (i + 1) / steps;
    shade.fillStyle(0x05060c, SHADE_MAX * t * t).fillRect(0, from + ((STAGE_H - from) * i) / steps, GAME_WIDTH, (STAGE_H - from) / steps + 1);
  }
  return scene.add.container(0, 0, [image, shade]);
}

/** Flat silhouette backdrops for the stage, filling y 0..STAGE_H, in one container so they can be grayed. */
function drawStage(scene: Phaser.Scene, stage: StageName): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const backdrop = scene.add.container(0, 0, [g]);
  const w = GAME_WIDTH;
  if (stage === 'street') {
    g.fillStyle(0x8fb8d8, 1).fillRect(0, 0, w, STAGE_H); // morning sky
    g.fillStyle(0xb9d3e6, 1).fillRect(0, 230, w, 120);
    // Far rooftops, then the near terrace with windows and a lamppost.
    g.fillStyle(0x7a8fa6, 1);
    for (const [x, top, bw] of [[0, 150, 110], [100, 120, 90], [180, 170, 120], [290, 110, 100], [380, 160, 90], [460, 130, 80]]) g.fillRect(x, top, bw, 392 - top);
    g.fillStyle(0x4f5d73, 1);
    for (const [x, top, bw] of [[0, 230, 150], [140, 200, 130], [260, 250, 140], [390, 215, 150]]) {
      g.fillRect(x, top, bw, 392 - top);
      g.fillStyle(0x3c475a, 1).fillTriangle(x, top, x + bw, top, x + bw / 2, top - 30);
      g.fillStyle(0xf2d27a, 0.55);
      for (let wy = top + 25; wy < 380; wy += 55) for (let wx = x + 20; wx < x + bw - 30; wx += 45) g.fillRect(wx, wy, 22, 28);
      g.fillStyle(0x4f5d73, 1);
    }
    g.fillStyle(0x2f3542, 1).fillRect(480, 260, 6, 150).fillRoundedRect(468, 252, 30, 12, 4); // lamppost
    // A corporate billboard on the rooftops.
    g.fillStyle(0x2b2f36, 1).fillRect(90, 118, 6, 40).fillRect(270, 118, 6, 40);
    g.fillStyle(0x1f2a3a, 1).fillRect(40, 48, 290, 74);
    g.lineStyle(3, 0xc9d3de, 1).strokeRect(40, 48, 290, 74);
    backdrop.add(scene.add.text(185, 72, 'DRONE & PARTNERS', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '22px', color: '#e8eef5' }).setOrigin(0.5));
    backdrop.add(scene.add.text(185, 102, 'Focus pays.', { fontFamily: 'Arial, sans-serif', fontSize: '18px', color: '#9fb3c8' }).setOrigin(0.5));
    g.fillStyle(0x8d8f99, 1).fillRect(0, 392, w, STAGE_H - 392); // pavement
    g.fillStyle(0x767884, 1).fillRect(0, 392, w, 6);
    for (let x = 0; x < w; x += 90) g.fillRect(x, 398, 3, STAGE_H - 398);
  } else if (stage === 'night') {
    g.fillStyle(0x141b2e, 1).fillRect(0, 0, w, STAGE_H); // night sky
    g.fillStyle(0xe8e4c8, 1).fillCircle(450, 90, 26); // moon
    g.fillStyle(0x141b2e, 1).fillCircle(462, 82, 22);
    g.fillStyle(0x222b40, 1);
    for (const [x, top, bw] of [[0, 170, 120], [110, 130, 110], [210, 190, 130], [330, 150, 100], [420, 200, 120]]) g.fillRect(x, top, bw, 392 - top);
    g.fillStyle(0xf2d27a, 0.6);
    for (const [x, y] of [[40, 230], [150, 180], [170, 260], [260, 250], [360, 210], [470, 270]]) g.fillRect(x, y, 18, 24);
    // Lamps with pools of light, a tram stop sign, and a dim billboard.
    for (const lx of [90, 400]) {
      g.fillStyle(0xffe8a0, 0.14).fillTriangle(lx, 250, lx - 70, 392, lx + 70, 392);
      g.fillStyle(0x0d111c, 1).fillRect(lx - 3, 250, 6, 142);
      g.fillStyle(0xfff1b8, 1).fillCircle(lx, 248, 7);
    }
    g.fillStyle(0x0d111c, 1).fillRect(258, 300, 5, 92).fillRoundedRect(240, 286, 42, 22, 4);
    g.fillStyle(0x2b2f36, 1).fillRect(80, 122, 5, 26).fillRect(250, 122, 5, 26);
    g.fillStyle(0x1a2230, 1).fillRect(40, 60, 250, 64);
    backdrop.add(scene.add.text(165, 82, 'DRONE & PARTNERS', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '19px', color: '#9fb3c8' }).setOrigin(0.5));
    backdrop.add(scene.add.text(165, 108, 'Focus pays.', { fontFamily: 'Arial, sans-serif', fontSize: '15px', color: '#6d8199' }).setOrigin(0.5));
    backdrop.add(scene.add.text(261, 297, 'TRAM', { fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '11px', color: '#e8e4c8' }).setOrigin(0.5));
    g.fillStyle(0x3a3f4a, 1).fillRect(0, 392, w, STAGE_H - 392); // pavement
    g.fillStyle(0x2e323b, 1).fillRect(0, 392, w, 6);
  } else if (stage === 'harbor') {
    g.fillStyle(0x5d6f86, 1).fillRect(0, 0, w, STAGE_H); // evening fog
    g.fillStyle(0x76879c, 1).fillRect(0, 170, w, 120);
    // Lighthouse on the far pier, its beam, and boats on the water.
    g.fillStyle(0x3e4c5e, 1).fillRect(40, 300, 150, 12).fillTriangle(80, 300, 110, 300, 100, 150).fillRect(88, 140, 16, 14);
    g.fillStyle(0xffe08a, 0.9).fillCircle(96, 147, 6);
    g.fillStyle(0xffe08a, 0.12).fillTriangle(96, 147, 300, 110, 300, 190);
    g.fillStyle(0x2f6f9a, 1).fillRect(0, 300, w, 92); // water
    g.fillStyle(0xffffff, 0.15);
    for (let y = 315; y < 385; y += 22) for (let x = (y % 44) - 10; x < w; x += 70) g.fillRoundedRect(x, y, 26, 3, 1.5);
    g.fillStyle(0x2a3442, 1);
    g.fillTriangle(250, 330, 390, 330, 370, 352).fillRect(250, 318, 140, 12).fillRect(300, 250, 5, 70); // fishing boat
    g.fillTriangle(305, 255, 305, 310, 350, 310);
    g.fillTriangle(420, 345, 520, 345, 505, 362).fillRect(420, 336, 100, 9); // rowing boat
    g.fillStyle(0x6b4f35, 1).fillRect(0, 392, w, STAGE_H - 392); // wooden quay
    g.fillStyle(0x5a4230, 1);
    for (let x = 0; x < w; x += 36) g.fillRect(x, 392, 3, STAGE_H - 392);
    g.fillStyle(0x2a2a2a, 1).fillRoundedRect(28, 372, 22, 26, 6).fillRoundedRect(498, 372, 22, 26, 6); // bollards
  } else {
    g.fillStyle(0x3a1f1a, 1).fillRect(0, 0, w, STAGE_H); // brick wall
    g.fillStyle(0x4a2a22, 1);
    for (let y = 10; y < 392; y += 28) {
      const shift = (y / 28) % 2 ? 0 : 30;
      for (let x = -60 + shift; x < w; x += 60) g.fillRect(x + 3, y, 54, 22);
    }
    // Arched doorway, a hanging lamp and instrument silhouettes on the wall.
    g.fillStyle(0x1d0f0c, 1).fillRect(210, 210, 120, 182).fillCircle(270, 210, 60);
    g.fillStyle(0x2a2a2a, 1).fillRect(268, 0, 4, 90);
    g.fillStyle(0xf2c94c, 0.9).fillTriangle(250, 110, 290, 110, 270, 86);
    g.fillStyle(0xf2c94c, 0.12).fillTriangle(180, 392, 360, 392, 270, 110);
    g.fillStyle(0x2a1410, 1);
    g.fillCircle(90, 200, 34).fillRect(84, 120, 12, 80); // tuba bell and pipe
    g.fillRect(410, 150, 90, 14).fillCircle(505, 157, 20); // trumpet
    g.fillCircle(455, 290, 30).fillRect(447, 250, 16, 40); // drum
    g.fillStyle(0x2b1a14, 1).fillRect(0, 392, w, STAGE_H - 392); // wooden floor
    g.fillStyle(0x23140f, 1);
    for (let y = 400; y < STAGE_H; y += 22) g.fillRect(0, y, w, 3);
  }
  return backdrop;
}
