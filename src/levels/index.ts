import type { LevelData } from './types';

// Every JSON file in this folder is a level. They are played in file-name
// order, so adding "level-02.json" adds a level without code changes.
const modules = import.meta.glob<LevelData>('./*.json', { eager: true, import: 'default' });

export const LEVELS: LevelData[] = Object.keys(modules)
  .sort()
  .map((path) => validate(modules[path], path));

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
  return level;
}
