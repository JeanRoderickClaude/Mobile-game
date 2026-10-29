import data from './items.json';

// Shop items. Each one is an entry in items.json; cosmetics.ts turns its
// "shape" (top-down, in the game) and "front" (front view, in dialogue and
// the locker) recipes and colours into drawings. A haircolor item is only a colour. Default items (beanie,
// magenta vest, no sign, brown hair) are always owned and are not listed here.

export type ItemCategory = 'hat' | 'outfit' | 'sign' | 'haircolor';

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** Cost in coins. */
  price: number;
  /** Top-down drawing recipe, one of SHAPES[category]. */
  shape: string;
  /** Front-view drawing recipe, one of FRONT_SHAPES[category]. */
  front: string;
  /** Main and secondary colour, as "#rrggbb". */
  color: string;
  accent: string;
}

export const CATEGORIES: ItemCategory[] = ['hat', 'outfit', 'sign', 'haircolor'];

/** Top-down shapes cosmetics.ts knows how to draw, per category. */
export const SHAPES: Record<ItemCategory, string[]> = {
  hat: ['bandana', 'beret', 'hardhat', 'crown', 'flowers'],
  outfit: ['tracksuit', 'jersey', 'poncho', 'cape', 'studded', 'scarf'],
  sign: ['placard', 'lollipop', 'flag', 'banner', 'star'],
  haircolor: ['color'],
};

/** Front-view shapes cosmetics.ts knows how to draw, per category. */
export const FRONT_SHAPES: Record<ItemCategory, string[]> = {
  hat: ['bandana', 'beret', 'hardhat', 'crown', 'flowers'],
  outfit: ['tracksuit', 'jersey', 'poncho', 'cape', 'studded', 'scarf'],
  sign: ['placard', 'lollipop', 'flag', 'banner', 'star'],
  haircolor: ['color'],
};

export const ITEMS: ShopItem[] = (data as ShopItem[]).map((item, i) => validate(item, i));

function validate(item: ShopItem, i: number): ShopItem {
  const fail = (msg: string): never => {
    throw new Error(`items.json entry ${i} (${item.id ?? '?'}): ${msg}`);
  };
  if (!item.id || !item.name) fail('needs "id" and "name"');
  if (!CATEGORIES.includes(item.category)) fail(`"category" must be one of ${CATEGORIES.join(', ')}`);
  if (!(Number.isInteger(item.price) && item.price > 0)) fail('"price" must be a positive whole number');
  if (!SHAPES[item.category].includes(item.shape)) fail(`"shape" must be one of ${SHAPES[item.category].join(', ')}`);
  if (!FRONT_SHAPES[item.category].includes(item.front)) fail(`"front" must be one of ${FRONT_SHAPES[item.category].join(', ')}`);
  for (const key of ['color', 'accent'] as const) if (!/^#[0-9a-f]{6}$/i.test(item[key])) fail(`"${key}" must look like "#c0392b"`);
  return item;
}

const ids = new Set<string>();
for (const item of ITEMS) {
  if (ids.has(item.id)) throw new Error(`items.json: duplicate id "${item.id}"`);
  ids.add(item.id);
}

export function itemById(id: string): ShopItem | undefined {
  return ITEMS.find((item) => item.id === id);
}
