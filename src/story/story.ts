import type Phaser from 'phaser';
import { LEVELS } from '../levels';
import { getFlags, isChapterDone } from '../systems/save';
import castJson from './cast.json';
import chaptersJson from './chapters.json';
import { checkFlagMap, matches, type Condition, type FlagValue } from './flags';

// Chapters, cast and dialogue scenes. All of it is data, checked once at
// startup; bad data throws an error naming the file and entry.

export type PortraitShape = 'circle' | 'square' | 'diamond' | 'triangle' | 'hexagon';
const SHAPES: PortraitShape[] = ['circle', 'square', 'diamond', 'triangle', 'hexagon'];

export interface CastMember {
  /** Shown next to the portrait, followed by a colon. */
  name: string;
  color: string;
  /** Placeholder portrait. */
  shape: PortraitShape;
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
}

export interface Dialogue {
  id: string;
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

export const CAST = castJson as Record<string, CastMember>;

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
  if (!Array.isArray(d.lines) || d.lines.length === 0) fail('needs a non-empty "lines" array');
  d.lines.forEach((line, i) => {
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
  for (const [key, c] of Object.entries(CAST)) {
    if (!SHAPES.includes(c.shape)) throw new Error(`src/story/cast.json: "${key}" shape must be one of ${SHAPES.join(', ')}`);
    if (!c.name) throw new Error(`src/story/cast.json: "${key}" needs a "name"`);
    if (!/^#[0-9a-f]{6}$/i.test(c.color)) throw new Error(`src/story/cast.json: "${key}" color must be #rrggbb`);
  }
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
