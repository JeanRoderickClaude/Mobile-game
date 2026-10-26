import data from './items.json';

// Shop items. Each one is an entry in items.json; cosmetics.ts turns its
// "shape" and colours into a drawing. Default items (beanie, magenta vest,
// no sign) are always owned and are not listed here.

export type ItemCategory = 'hat' | 'outfit' | 'sign';

export interface ShopItem {
  id: string;
  name: string;
  category: ItemCategory;
  /** Cost in coins. */
  price: number;
  /** Drawing recipe, one of SHAPES[category]. */
  shape: string;
  /** Main and secondary colour, as "#rrggbb". */
  color: string;
  accent: string;
}

export const CATEGORIES: ItemCategory[] = ['hat', 'outfit', 'sign'];

/** Shapes cosmetics.ts knows how to draw, per category. */
export const SHAPES: Record<ItemCategory, string[]> = {
  hat: ['bandana', 'beret', 'hardhat', 'crown'],
  outfit: ['tracksuit', 'jersey', 'poncho', 'cape'],
  sign: ['placard', 'lollipop', 'flag', 'banner'],
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
