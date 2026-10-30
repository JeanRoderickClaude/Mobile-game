import { checkFlagMap } from '../story/flags';
import { MODIFIER_FACTORS, type LevelData } from './types';

// Every JSON file in this folder is a level. They are played in file-name
// order, so adding "level-02.json" adds a level without code changes.
const modules = import.meta.glob<LevelData>('./*.json', { eager: true, import: 'default' });
// Levels in ./dev/ are practice levels for trying a mechanic. They come after the real levels, so the real levels
// keep their indices. The build setting VITE_PRACTICE_LEVEL=off leaves them (and the menu's Practice button) out;
// the branch below is then removed from the bundle.
const devModules = import.meta.env.VITE_PRACTICE_LEVEL !== 'off' ? import.meta.glob<LevelData>('./dev/*.json', { eager: true, import: 'default' }) : {};

export const LEVELS: LevelData[] = [
  ...Object.keys(modules).sort().map((path) => validate(modules[path], path)),
  ...Object.keys(devModules).sort().map((path) => validate(devModules[path], path)),
];

/** Index of the practice level for the chase and search system, or -1 when the build setting VITE_PRACTICE_LEVEL=off is used. */
export const PRACTICE_LEVEL_INDEX = LEVELS.findIndex((l) => l.id === 'practice-chase');

function validate(level: LevelData, path: string): LevelData {
  const fail = (msg: string): never => {
    throw new Error(`Level ${path}: ${msg}`);
  };
  if (!level.id || !level.name) fail('needs "id" and "name"');
  if (!(level.width > 0 && level.height > 0)) fail('needs positive "width" and "height"');
  if (!level.start || !level.finish) fail('needs "start" and "finish"');
  if (!Array.isArray(level.obstacles)) fail('"obstacles" must be an array');
  if (!Array.isArray(level.officers)) fail('"officers" must be an array');
  level.officers.forEach((o, i) => {
    if (!Array.isArray(o.patrol) || o.patrol.length < 1) fail(`officer ${i} needs at least one patrol point`);
    if (o.mode !== 'loop' && o.mode !== 'pingpong') fail(`officer ${i} "mode" must be "loop" or "pingpong"`);
  });
  level.crowds ??= [];
  if (!Array.isArray(level.crowds)) fail('"crowds" must be an array');
  level.crowds.forEach((c, i) => {
    if (!(c.size >= 1)) fail(`crowd ${i} needs a "size" of at least 1`);
    if (c.type === 'marching') {
      if (!Array.isArray(c.path) || c.path.length < 2) fail(`crowd ${i} needs at least two path points`);
      if (!(c.intervalMs >= 0)) fail(`crowd ${i} needs "intervalMs"`);
    } else if (c.type === 'standing') {
      if (typeof c.x !== 'number' || typeof c.y !== 'number') fail(`crowd ${i} needs "x" and "y"`);
    } else {
      fail(`crowd ${i} "type" must be "marching" or "standing"`);
    }
  });
  level.coins ??= [];
  if (!Array.isArray(level.coins)) fail('"coins" must be an array');
  level.coins.forEach((c, i) => {
    if (typeof c.x !== 'number' || typeof c.y !== 'number') fail(`coin ${i} needs "x" and "y"`);
    if (c.value !== undefined && !(Number.isInteger(c.value) && c.value > 0)) fail(`coin ${i} "value" must be a positive whole number`);
  });
  if (level.parTimeSec !== undefined && !(level.parTimeSec > 0)) fail('"parTimeSec" must be positive');
  level.bystanders ??= [];
  if (!Array.isArray(level.bystanders)) fail('"bystanders" must be an array');
  level.bystanders.forEach((b, i) => {
    if (typeof b.x !== 'number' || typeof b.y !== 'number') fail(`bystander ${i} needs "x" and "y"`);
    if (b.wander !== undefined && !(b.wander >= 0)) fail(`bystander ${i} "wander" must be 0 or more`);
    if (b.kind !== undefined && b.kind !== 'local' && b.kind !== 'commuter') fail(`bystander ${i} "kind" must be "local" or "commuter"`);
  });
  if (level.bystanders.length > 0 && !level.trumpet) fail('"bystanders" only come when Pip plays; set "trumpet": true');
  level.obstacles.forEach((o, i) => {
    const ok = o.style === undefined || (o.style === 'water' && o.type === 'building') || (o.style === 'squad-van' && o.type === 'car');
    if (!ok) fail(`obstacle ${i} "style" must be "water" on a building or "squad-van" on a car`);
  });
  const isPoint = (p: { x: unknown; y: unknown }) => typeof p.x === 'number' && typeof p.y === 'number';
  if (level.night !== undefined) {
    if (!level.night || !Array.isArray(level.night.lights)) fail('"night" needs a "lights" array (it may be empty)');
    level.night.lights.forEach((l, i) => (!isPoint(l) || !(l.radius > 0)) && fail(`light ${i} needs "x", "y" and a positive "radius"`));
  }
  if (level.posters !== undefined) {
    const p = level.posters;
    if (!p || !Array.isArray(p.spots)) fail('"posters" needs a "spots" array');
    p.spots.forEach((s, i) => (!isPoint(s) || (s.wall !== 'left' && s.wall !== 'right')) && fail(`poster spot ${i} needs "x", "y" and "wall" ("left" or "right")`));
    if (!(Number.isInteger(p.required) && p.required >= 1 && p.required <= p.spots.length)) fail('"posters" "required" must be a whole number from 1 to the number of spots');
    if (!(Number.isInteger(p.bonusCoins) && p.bonusCoins >= 0)) fail('"posters" "bonusCoins" must be a whole number, 0 or more');
  }
  level.tags ??= [];
  if (!Array.isArray(level.tags)) fail('"tags" must be an array');
  level.tags.forEach((t, i) => {
    if (!isPoint(t) || !t.label || !t.flag) fail(`tag ${i} needs "x", "y", "label" and "flag"`);
    if (!(Number.isInteger(t.coins) && t.coins >= 0) || !(t.ms > 0)) fail(`tag ${i} needs whole "coins" (0 or more) and positive "ms"`);
  });
  if (level.instrumentCase !== undefined) {
    const c = level.instrumentCase;
    if (!c || !isPoint(c) || !c.flag) fail('"instrumentCase" needs "x", "y" and "flag"');
    if (!level.trumpet) fail('"instrumentCase" uses the trumpet button; set "trumpet": true');
  }
  if (level.chaseMode !== undefined && typeof level.chaseMode !== 'boolean') fail('"chaseMode" must be true or false');
  if (level.hints !== undefined) {
    if (!Array.isArray(level.hints)) fail('"hints" must be an array');
    level.hints.forEach((h, i) => (!h.id || !isPoint(h) || !(h.radius > 0) || !h.text) && fail(`hint ${i} needs "id", "x", "y", a positive "radius" and "text"`));
  }
  if (level.teun !== undefined) {
    if (!level.teun || !isPoint(level.teun)) fail('"teun" needs "x" and "y"');
    if (!level.chaseMode) fail('"teun" needs "chaseMode": true (an officer who spots him starts a chase)');
    if (!level.trumpet) fail('"teun" needs "trumpet": true (his drum fills the noise meter)');
  }
  if (level.neon !== undefined) {
    if (!Array.isArray(level.neon)) fail('"neon" must be an array');
    level.neon.forEach((n, i) => {
      if (![n.x, n.y, n.width, n.height].every((v) => typeof v === 'number') || !(n.width > 0 && n.height > 0)) fail(`neon ${i} needs "x", "y" and positive "width" and "height"`);
      if (!/^#[0-9a-f]{6}$/i.test(n.color)) fail(`neon ${i} "color" must look like "#ff3fa4"`);
    });
  }
  if (level.noir !== undefined) {
    if (!level.noir || !Array.isArray(level.noir.zones)) fail('"noir" needs a "zones" array (it may be empty)');
    level.noir.zones.forEach((z, i) => {
      if (![z.x, z.y, z.width, z.height].every((v) => typeof v === 'number') || !(z.width > 0 && z.height > 0)) fail(`noir zone ${i} needs "x", "y" and positive "width" and "height"`);
      if (z.start !== 'gray' && z.start !== 'color') fail(`noir zone ${i} "start" must be "gray" or "color"`);
      if (z.musicMs !== undefined && !(z.musicMs > 0 && z.start === 'gray')) fail(`noir zone ${i} "musicMs" must be positive, on a gray zone`);
      if (z.musicMs !== undefined && !level.trumpet) fail(`noir zone ${i} has "musicMs" but the level has no trumpet`);
    });
  }
  const lists = { obstacle: level.obstacles, officer: level.officers, crowd: level.crowds, coin: level.coins, bystander: level.bystanders };
  for (const [what, list] of Object.entries(lists)) {
    list.forEach((e, i) => e.if !== undefined && checkFlagMap(e.if, fail, `${what} ${i} "if"`));
  }
  level.modifiers ??= [];
  if (!Array.isArray(level.modifiers)) fail('"modifiers" must be an array');
  level.modifiers.forEach((m, i) => {
    if (m.if !== undefined) checkFlagMap(m.if, fail, `modifier ${i} "if"`);
    for (const key of MODIFIER_FACTORS) {
      if (m[key] !== undefined && !(typeof m[key] === 'number' && m[key] > 0)) fail(`modifier ${i} "${key}" must be a positive number`);
    }
    for (const key of Object.keys(m)) {
      if (key !== 'if' && !(MODIFIER_FACTORS as readonly string[]).includes(key)) fail(`modifier ${i} has unknown field "${key}"`);
    }
  });
  return level;
}
