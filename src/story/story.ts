import type Phaser from 'phaser';
import { BODIES, isKnownItem, type PlayerLook } from '../entities/cosmetics';
import { LEVELS } from '../levels';
import { getFlags, isChapterDone } from '../systems/save';
import castJson from './cast.json';
import chaptersJson from './chapters.json';
import { checkFlagMap, matches, type Condition, type FlagValue } from './flags';

// Chapters, cast and dialogue scenes. All of it is data, checked once at
// startup; bad data throws an error naming the file and entry.

export interface CastMember {
  /** Shown above the line, followed by a colon. */
  name: string;
  /** Colour of the name. */
  color: string;
  /** What they wear on stage, in front view. Left-out parts use CAST_LOOK_DEFAULTS. Pip ignores it and wears the player's equipped items. */
  look?: Partial<PlayerLook>;
}

/** The cast id that always wears the player's equipped look and stands leftmost. */
export const PLAYER_CAST_ID = 'pip';
export const CAST_LOOK_DEFAULTS: PlayerLook = { body: 'light', outfit: 'tee-grey', hat: 'none', sign: 'none' };

/** Background strips for the stage. */
export const STAGES = ['street', 'night', 'harbor', 'cellar'] as const;
export type StageName = (typeof STAGES)[number];

/** A character in a scene and where they stand. */
export interface StagePlace {
  /** Cast id. */
  id: string;
  /** Centre x in the 540-wide design space. */
  x: number;
  /** Starts off stage; comes on with a line's "enter". */
  offstage?: boolean;
}

export interface Choice {
  text: string;
  /** Story flags set when this choice is picked. */
  set: Record<string, FlagValue>;
}

export interface DialogueLine {
  /** Key into cast.json. Left out for narration: no name or portrait, italic text. */
  speaker?: string;
  text: string;
  /** Optional. The line is skipped unless the story flags match. */
  if?: Condition;
  /** Optional, 2 to 4. The scene waits on this line until one is picked. */
  choices?: Choice[];
  /** Cast ids that walk on before this line shows. Each must be in the scene's "cast". */
  enter?: string[];
  /** Cast ids that walk off before this line shows. */
  exit?: string[];
  /** Turns the backdrop gray or colour as this line shows (fades over half a second). */
  tone?: Tone;
}

/** Backdrop look: "gray" for controlled, corporate places; "color" where music lives. */
export type Tone = 'gray' | 'color';

export interface Dialogue {
  id: string;
  /** Background strip behind the characters. */
  stage: StageName;
  /** Backdrop look at the start of the scene. Default "color". */
  tone?: Tone;
  /** Everyone who appears on stage during the scene, with their spots. */
  cast: StagePlace[];
  lines: DialogueLine[];
}

/** A dialogue id, or variants where the first whose "if" matches plays. */
export type SceneRef = string | { scene: string; if?: Condition }[];

export interface Chapter {
  id: string;
  title: string;
  /** Level id. Chapters without one show as "Coming soon". */
  level?: string;
  intro?: SceneRef;
  outro?: SceneRef;
}

export const CAST = validateCast(castJson as Record<string, CastMember>);

const dialogueModules = import.meta.glob<Omit<Dialogue, 'id'>>('./dialogue/*.json', { eager: true, import: 'default' });

export const DIALOGUES: Record<string, Dialogue> = Object.fromEntries(
  Object.entries(dialogueModules).map(([path, data]) => {
    const id = path.replace(/^.*\//, '').replace(/\.json$/, '');
    return [id, validateDialogue({ ...data, id }, path)];
  }),
);

export const CHAPTERS: Chapter[] = validateChapters(chaptersJson as Chapter[]);

function validateDialogue(d: Dialogue, path: string): Dialogue {
  const fail = (msg: string): never => {
    throw new Error(`Dialogue ${path}: ${msg}`);
  };
  if (!STAGES.includes(d.stage)) fail(`"stage" must be one of ${STAGES.join(', ')}`);
  if (!Array.isArray(d.cast)) fail('needs a "cast" array (it may be empty)');
  const tones = ['gray', 'color'];
  if (d.tone !== undefined && !tones.includes(d.tone)) fail('"tone" must be "gray" or "color"');
  (d.lines ?? []).forEach((l, i) => l.tone !== undefined && !tones.includes(l.tone) && fail(`line ${i} "tone" must be "gray" or "color"`));
  const onStage = new Set<string>();
  d.cast.forEach((p, i) => {
    if (!Object.hasOwn(CAST, p.id)) fail(`cast ${i} "${p.id}" is not in src/story/cast.json`);
    if (onStage.has(p.id)) fail(`cast "${p.id}" is listed twice`);
    onStage.add(p.id);
    if (!(typeof p.x === 'number' && p.x >= 40 && p.x <= 500)) fail(`cast "${p.id}" needs "x" between 40 and 500`);
  });
  const pip = d.cast.find((p) => p.id === PLAYER_CAST_ID);
  if (pip && d.cast.some((p) => p.x < pip.x)) fail('Pip must stand leftmost');
  if (!Array.isArray(d.lines) || d.lines.length === 0) fail('needs a non-empty "lines" array');
  d.lines.forEach((line, i) => {
    for (const key of ['enter', 'exit'] as const) {
      const ids = line[key];
      if (ids === undefined) continue;
      if (!Array.isArray(ids)) fail(`line ${i} "${key}" must be a list of cast ids`);
      for (const id of ids) if (!onStage.has(id)) fail(`line ${i} "${key}" names "${id}", who is not in the scene's "cast"`);
    }
    if (line.speaker !== undefined && !Object.hasOwn(CAST, line.speaker)) fail(`line ${i} speaker "${line.speaker}" is not in src/story/cast.json`);
    if (typeof line.text !== 'string' || !line.text) fail(`line ${i} needs "text"`);
    if (line.if !== undefined) checkFlagMap(line.if, fail, `line ${i} "if"`);
    if (line.choices !== undefined) {
      if (!Array.isArray(line.choices) || line.choices.length < 2 || line.choices.length > 4) fail(`line ${i} needs 2 to 4 "choices"`);
      line.choices.forEach((c, j) => {
        if (typeof c.text !== 'string' || !c.text) fail(`line ${i} choice ${j} needs "text"`);
        checkFlagMap(c.set, fail, `line ${i} choice ${j} "set"`);
      });
    }
  });
  return d;
}

function validateChapters(chapters: Chapter[]): Chapter[] {
  const fail = (msg: string): never => {
    throw new Error(`src/story/chapters.json: ${msg}`);
  };
  const ids = new Set<string>();
  chapters.forEach((c, i) => {
    if (!c.id || !c.title) fail(`chapter ${i} needs "id" and "title"`);
    if (ids.has(c.id)) fail(`chapter id "${c.id}" is used twice`);
    ids.add(c.id);
    if (c.level !== undefined && !LEVELS.some((l) => l.id === c.level)) fail(`chapter "${c.id}" level "${c.level}" is not in src/levels/`);
    for (const key of ['intro', 'outro'] as const) {
      const ref = c[key];
      if (ref === undefined) continue;
      const variants = typeof ref === 'string' ? [{ scene: ref }] : ref;
      if (!Array.isArray(variants) || variants.length === 0) fail(`chapter "${c.id}" "${key}" must be a dialogue id or a list of variants`);
      for (const v of variants) {
        if (!Object.hasOwn(DIALOGUES, v.scene)) fail(`chapter "${c.id}" ${key} "${v.scene}" is not in src/story/dialogue/`);
        if ('if' in v && v.if !== undefined) checkFlagMap(v.if, fail, `chapter "${c.id}" ${key} "if"`);
      }
    }
  });
  return chapters;
}

function validateCast(cast: Record<string, CastMember>): Record<string, CastMember> {
  const fail = (msg: string): never => {
    throw new Error(`src/story/cast.json: ${msg}`);
  };
  if (!Object.hasOwn(cast, PLAYER_CAST_ID)) fail(`needs "${PLAYER_CAST_ID}"`);
  for (const [key, c] of Object.entries(cast)) {
    if (!c.name) fail(`"${key}" needs a "name"`);
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) fail(`"${key}" color must be #rrggbb`);
    const look = c.look ?? {};
    if (look.body !== undefined && !Object.hasOwn(BODIES, look.body)) fail(`"${key}" look body "${look.body}" is not in BODIES`);
    for (const part of ['outfit', 'hat', 'sign'] as const) {
      const id = look[part];
      if (id !== undefined && !isKnownItem(part, id)) fail(`"${key}" look ${part} "${id}" is not a known ${part}`);
    }
  }
  return cast;
}

/** What a cast member wears on stage; Pip's comes from the caller (the equipped look). */
export function castLook(id: string): PlayerLook {
  return { ...CAST_LOOK_DEFAULTS, ...CAST[id].look };
}

/** The dialogue a scene reference plays with the current flags, or undefined. */
export function pickScene(ref: SceneRef | undefined): Dialogue | undefined {
  if (ref === undefined) return undefined;
  if (typeof ref === 'string') return DIALOGUES[ref];
  const flags = getFlags();
  const hit = ref.find((v) => matches(v.if, flags));
  return hit && DIALOGUES[hit.scene];
}

export type ChapterState = 'done' | 'open' | 'locked';

/** Chapter 1 is always open; each later one opens when the one before it is done. */
export function chapterState(index: number): ChapterState {
  if (isChapterDone(CHAPTERS[index].id)) return 'done';
  return index === 0 || isChapterDone(CHAPTERS[index - 1].id) ? 'open' : 'locked';
}

/** Open or done, and has a level to play. */
export function isPlayable(index: number): boolean {
  const c = CHAPTERS[index];
  return c !== undefined && c.level !== undefined && chapterState(index) !== 'locked';
}

export function levelIndexOf(chapter: Chapter): number {
  return LEVELS.findIndex((l) => l.id === chapter.level);
}

/** Plays the chapter's intro (if any), then its level. */
export function startChapter(scene: Phaser.Scene, index: number): void {
  const chapter = CHAPTERS[index];
  const game = { key: 'game', data: { levelIndex: levelIndexOf(chapter), chapterIndex: index } };
  const intro = pickScene(chapter.intro);
  if (intro) scene.scene.start('dialogue', { dialogueId: intro.id, then: game });
  else scene.scene.start(game.key, game.data);
}
