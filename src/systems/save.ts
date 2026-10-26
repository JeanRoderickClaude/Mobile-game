import { DEFAULT_ITEMS, DEFAULT_LOOK, isKnownItem, type PlayerLook } from '../entities/cosmetics';
import { itemById, type ItemCategory, type ShopItem } from '../data/items';

// Player progress: coin balance, bought items and the equipped look. Kept in
// memory and mirrored to localStorage. Storage can be blocked (private mode,
// sandboxed iframes, full quota); every access is wrapped so the game still
// runs, it just forgets progress on reload.

/** Bump the version when the stored shape changes incompatibly. */
export const SAVE_KEY = 'protest-route.save.v1';

export interface SaveData {
  coins: number;
  /** Ids of bought shop items. Default items are always owned and not listed. */
  owned: string[];
  equipped: Record<ItemCategory, string>;
}

function fresh(): SaveData {
  return { coins: 0, owned: [], equipped: { ...DEFAULT_ITEMS } };
}

let state: SaveData = load();

function load(): SaveData {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SAVE_KEY);
  } catch {
    return fresh();
  }
  if (!raw) return fresh();
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return fresh();
  }
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

/** The look the player wears in a run. */
export function equippedLook(): PlayerLook {
  return { ...DEFAULT_LOOK, ...state.equipped };
}
