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
  return level;
}
