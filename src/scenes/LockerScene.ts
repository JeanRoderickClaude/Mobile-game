import Phaser from 'phaser';
import { COLORS, GAME_WIDTH } from '../config';
import { Character } from '../entities/Character';
import { DEFAULT_ITEMS, DEFAULT_LOOK, type PlayerLook } from '../entities/cosmetics';
import { CATEGORIES, ITEMS, type ItemCategory, type ShopItem } from '../data/items';
import { buy, equip, equippedId, equippedLook, getCoins, owns } from '../systems/save';
import { CoinLabel, FONT, FONT_BOLD, makeButton, type Button } from '../ui/widgets';

const TAB_LABELS: Record<ItemCategory, string> = { hat: 'Hats', outfit: 'Outfits', sign: 'Signs' };
const DEFAULT_NAMES: Record<ItemCategory, string> = { hat: 'Beanie', outfit: 'Magenta vest', sign: 'No sign' };

/** A tile in the grid: the default item of a category or a shop item. */
interface Entry {
  id: string;
  name: string;
  price: number; // 0 for defaults
}

interface Tile {
  entry: Entry;
  frame: Phaser.GameObjects.Rectangle;
  status: Phaser.GameObjects.Text;
}

const TILE_W = 160;
const TILE_H = 150;
const COLS = [95, 270, 445];
const ROWS = [620, 784];

/**
 * The locker room shop. The big character previews whatever tile is tapped;
 * the action button below buys or equips it. Only equipping changes the look
 * used in the game.
 */
export class LockerScene extends Phaser.Scene {
  private category: ItemCategory = 'hat';
  private selected = '';
  private preview!: Character;
  private previewName!: Phaser.GameObjects.Text;
  private balance!: CoinLabel;
  private tabs = new Map<ItemCategory, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }>();
  private grid: Phaser.GameObjects.GameObject[] = [];
  private tiles: Tile[] = [];
  private action!: Button;

  constructor() {
    super('locker');
  }

  create(): void {
    const cx = GAME_WIDTH / 2;
    this.cameras.main.setBackgroundColor(COLORS.background);
    this.tabs.clear();
    this.grid = [];
    this.tiles = [];

    makeButton(this, 80, 45, 'Back', () => this.scene.start('menu'), 120, 50);
    this.add.text(cx, 45, 'Locker', { fontFamily: FONT_BOLD, fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
    this.balance = new CoinLabel(this, 0, 45, getCoins());
    this.alignBalance();

    // The character in front view, drawn large on a floor shadow. Signs reach well above the head.
    // The tiles below show items top-down, as they look in a run.
    this.add.circle(cx, 260, 150, 0xffffff, 0.05);
    this.add.ellipse(cx, 410, 150, 26, 0x000000, 0.3);
    this.preview = new Character(this, cx, 410, equippedLook(), { view: 'front' }).setScale(3.05);
    this.previewName = this.add.text(cx, 445, '', { fontFamily: FONT_BOLD, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);

    CATEGORIES.forEach((category, i) => {
      const x = COLS[i];
      const bg = this.add.rectangle(x, 500, 160, 52, 0x34374a).setStrokeStyle(2, 0xffffff, 0.3).setInteractive({ useHandCursor: true });
      const label = this.add.text(x, 500, TAB_LABELS[category], { fontFamily: FONT_BOLD, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
      bg.on('pointerup', () => this.showCategory(category));
      this.tabs.set(category, { bg, label });
    });

    this.action = makeButton(this, cx, 905, '', () => this.onAction(), 320, 66);

    this.input.keyboard!.once('keydown-ESC', () => this.scene.start('menu'));
    this.showCategory('hat');
  }

  private entries(category: ItemCategory): Entry[] {
    const defaults: Entry = { id: DEFAULT_ITEMS[category], name: DEFAULT_NAMES[category], price: 0 };
    const items = ITEMS.filter((item) => item.category === category).sort((a, b) => a.price - b.price);
    return [defaults, ...items.map((item: ShopItem) => ({ id: item.id, name: item.name, price: item.price }))];
  }

  private showCategory(category: ItemCategory): void {
    this.category = category;
    for (const [c, tab] of this.tabs) {
      tab.bg.setFillStyle(c === category ? 0xf2c94c : 0x34374a);
      tab.label.setColor(c === category ? '#1d1f2b' : '#ffffff');
    }
    for (const o of this.grid) o.destroy();
    this.grid = [];
    this.tiles = [];

    this.entries(category).forEach((entry, i) => {
      const x = COLS[i % 3];
      const y = ROWS[Math.floor(i / 3)];
      const frame = this.add.rectangle(x, y, TILE_W, TILE_H, 0x2a2d3c).setInteractive({ useHandCursor: true });
      frame.on('pointerup', () => this.select(entry.id));
      // Mini character wearing just this item on top of the default look.
      const look: PlayerLook = { ...DEFAULT_LOOK, [category]: entry.id };
      const mini = new Character(this, x, y - 12 + (category === 'sign' ? 14 : 0), look).setScale(category === 'sign' ? 1.6 : 2);
      const name = this.add.text(x, y + 38, entry.name, { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5);
      const status = this.add.text(x, y + 60, '', { fontFamily: FONT_BOLD, fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
      this.grid.push(frame, mini, name, status);
      this.tiles.push({ entry, frame, status });
    });
    this.select(equippedId(category));
  }

  private select(id: string): void {
    this.selected = id;
    const look: PlayerLook = { ...equippedLook(), [this.category]: id };
    this.preview.setLook(look);
    this.refresh();
  }

  /** Redraws tile states, the preview label and the action button for the current selection. */
  private refresh(): void {
    const coins = getCoins();
    this.balance.setValue(coins);
    this.alignBalance();
    for (const t of this.tiles) {
      const { id, price } = t.entry;
      const isSelected = id === this.selected;
      t.frame.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xf2c94c : 0xffffff, isSelected ? 1 : 0.2);
      if (equippedId(this.category) === id) t.status.setText('EQUIPPED').setColor('#7be08f');
      else if (owns(this.category, id)) t.status.setText('OWNED').setColor('#b5b7c0');
      else t.status.setText(`${price} coins`).setColor(coins >= price ? '#f2c94c' : '#e07a7a');
    }

    const entry = this.tiles.find((t) => t.entry.id === this.selected)?.entry;
    if (!entry) return;
    this.previewName.setText(entry.name);
    if (equippedId(this.category) === entry.id) {
      this.action.setText('Equipped');
      this.action.setEnabled(false);
    } else if (owns(this.category, entry.id)) {
      this.action.setText('Equip');
      this.action.setEnabled(true);
    } else {
      this.action.setText(`Buy for ${entry.price}`);
      this.action.setEnabled(coins >= entry.price);
    }
  }

  private onAction(): void {
    const id = this.selected;
    if (owns(this.category, id)) {
      equip(this.category, id);
    } else {
      const item = ITEMS.find((i) => i.id === id);
      if (!item || !buy(item)) return;
    }
    this.refresh();
  }

  private alignBalance(): void {
    this.balance.x = GAME_WIDTH - 20 - this.balance.labelWidth;
  }
}
