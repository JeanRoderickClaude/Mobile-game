import { DEFAULT_DIFFICULTY, DIFFICULTIES, LEGACY_DIFFICULTY, type Difficulty } from '../config';
import { DEFAULT_ITEMS, DEFAULT_LOOK, isKnownItem, type PlayerLook } from '../entities/cosmetics';
import { itemById, type ItemCategory, type ShopItem } from '../data/items';
import { isFlagValue, type FlagValue, type Flags } from '../story/flags';

// Player progress: coin balance, bought items and the equipped look. Kept in
// memory and mirrored to localStorage. Storage can be blocked (private mode,
// sandboxed iframes, full quota); every access is wrapped so the game still
// runs, it just forgets progress on reload.

/** Bump the version when the stored shape changes incompatibly. */
export const SAVE_KEY = 'protest-route.save.v2';
/** Older keys, newest first. The first one found is migrated into SAVE_KEY and left in place. */
const OLD_KEYS = ['protest-route.save.v1'];

export interface SaveData {
  coins: number;
  /** Ids of bought shop items. Default items are always owned and not listed. */
  owned: string[];
  equipped: Record<ItemCategory, string>;
  /** New saves start on DEFAULT_DIFFICULTY; saves from before difficulties existed load as LEGACY_DIFFICULTY. */
  difficulty: Difficulty;
  /** Ids of finished chapters (see src/story/chapters.json). */
  completed: string[];
  /** Story flags set by dialogue choices. */
  flags: Flags;
  /** Show the frame rate in a corner during levels (menu toggle). */
  showFps: boolean;
  /** Ids of one-time hints already shown (see GameScene). Saves from before hints existed have none. */
  hintsSeen: string[];
}

/** Story flags that were renamed: old name to new name. Saves are migrated when they load. */
const RENAMED_FLAGS: Record<string, string> = { van_tagged: 'vanTagged' };

function fresh(): SaveData {
  return { coins: 0, owned: [], equipped: { ...DEFAULT_ITEMS }, difficulty: DEFAULT_DIFFICULTY, completed: [], flags: {}, showFps: false, hintsSeen: [] };
}

let state: SaveData = load();

function load(): SaveData {
  let raw: string | null = null;
  let migrated = false;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
    for (let i = 0; !raw && i < OLD_KEYS.length; i++) {
      raw = window.localStorage.getItem(OLD_KEYS[i]);
      migrated = raw !== null;
    }
  } catch {
    return fresh();
  }
  if (!raw) return fresh();
  let data: SaveData;
  try {
    // v1 saves have no story fields; sanitize fills them in as empty.
    data = sanitize(JSON.parse(raw));
  } catch {
    return fresh();
  }
  // A renamed story flag or an older key: write the migrated save back.
  if (migrated || raw.includes('"van_tagged"')) {
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage blocked: the migrated save lives for this session only.
    }
  }
  return data;
}

/** Keeps only well-formed values, so a hand-edited or old save cannot break the game. */
function sanitize(input: unknown): SaveData {
  const out = fresh();
  if (typeof input !== 'object' || input === null) return out;
  const data = input as Partial<SaveData>;
  if (typeof data.coins === 'number' && Number.isFinite(data.coins) && data.coins > 0) out.coins = Math.floor(data.coins);
  if (Array.isArray(data.owned)) out.owned = [...new Set(data.owned.filter((id) => typeof id === 'string' && itemById(id)))];
  if (data.equipped && typeof data.equipped === 'object') {
    for (const category of Object.keys(out.equipped) as ItemCategory[]) {
      const id = data.equipped[category];
      if (typeof id === 'string' && isKnownItem(category, id) && ownsIn(out, category, id)) out.equipped[category] = id;
    }
  }
  out.difficulty = typeof data.difficulty === 'string' && Object.hasOwn(DIFFICULTIES, data.difficulty) ? data.difficulty : LEGACY_DIFFICULTY;
  if (Array.isArray(data.completed)) out.completed = [...new Set(data.completed.filter((id) => typeof id === 'string'))];
  if (data.flags && typeof data.flags === 'object' && !Array.isArray(data.flags)) {
    for (const [name, value] of Object.entries(data.flags)) if (isFlagValue(value)) out.flags[RENAMED_FLAGS[name] ?? name] = value;
    // A save that has both names keeps the new one's value.
    for (const [oldName, newName] of Object.entries(RENAMED_FLAGS)) {
      const value = (data.flags as Flags)[newName];
      if (oldName in data.flags && isFlagValue(value)) out.flags[newName] = value;
    }
  }
  out.showFps = data.showFps === true;
  // Added after the first saves: a missing or malformed list means no hint has been shown.
  if (Array.isArray(data.hintsSeen)) out.hintsSeen = [...new Set(data.hintsSeen.filter((id) => typeof id === 'string'))];
  return out;
}

function ownsIn(data: SaveData, category: ItemCategory, id: string): boolean {
  return id === DEFAULT_ITEMS[category] || data.owned.includes(id);
}

function persist(): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Storage blocked or full: progress lives for this session only.
  }
}

export function getCoins(): number {
  return state.coins;
}

export function addCoins(amount: number): void {
  state.coins += Math.max(0, Math.floor(amount));
  persist();
}

export function owns(category: ItemCategory, id: string): boolean {
  return ownsIn(state, category, id);
}

export function equippedId(category: ItemCategory): string {
  return state.equipped[category];
}

/** Spends the coins and adds the item. Returns false when it is owned or unaffordable. */
export function buy(item: ShopItem): boolean {
  if (owns(item.category, item.id) || state.coins < item.price) return false;
  state.coins -= item.price;
  state.owned.push(item.id);
  persist();
  return true;
}

export function equip(category: ItemCategory, id: string): boolean {
  if (!owns(category, id)) return false;
  state.equipped[category] = id;
  persist();
  return true;
}

export function getDifficulty(): Difficulty {
  return state.difficulty;
}

export function setDifficulty(difficulty: Difficulty): void {
  state.difficulty = difficulty;
  persist();
}

export function getShowFps(): boolean {
  return state.showFps;
}

export function setShowFps(on: boolean): void {
  state.showFps = on;
  persist();
}

export function hasSeenHint(id: string): boolean {
  return state.hintsSeen.includes(id);
}

export function markHintSeen(id: string): void {
  if (hasSeenHint(id)) return;
  state.hintsSeen.push(id);
  persist();
}

export function isChapterDone(id: string): boolean {
  return state.completed.includes(id);
}

export function completeChapter(id: string): void {
  if (isChapterDone(id)) return;
  state.completed.push(id);
  persist();
}

/** A copy of the story flags. */
export function getFlags(): Flags {
  return { ...state.flags };
}

export function setFlags(values: Record<string, FlagValue>): void {
  Object.assign(state.flags, values);
  persist();
}

/** The look the player wears in a run. */
export function equippedLook(): PlayerLook {
  return { ...DEFAULT_LOOK, hat: state.equipped.hat, outfit: state.equipped.outfit, sign: state.equipped.sign, hairColor: state.equipped.haircolor };
}
