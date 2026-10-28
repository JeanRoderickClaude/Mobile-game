import { matches, type Flags } from '../story/flags';
import type { LevelData, ResolvedLevel } from './types';

/**
 * Applies story flags to a level: entries whose "if" does not match are left
 * out, and matching modifiers scale crowds and officers. The input is not changed.
 */
export function resolveLevel(level: LevelData, flags: Flags): ResolvedLevel {
  const keep = <T extends { if?: Record<string, unknown> }>(list: T[] | undefined) =>
    (list ?? []).filter((e) => matches(e.if as Flags | undefined, flags));
  let crowdSize = 1;
  let vision = 1;
  let officerSpeed = 1;
  let catchTime = 1;
  for (const m of keep(level.modifiers)) {
    crowdSize *= m.crowdSizeFactor ?? 1;
    vision *= m.visionRangeFactor ?? 1;
    officerSpeed *= m.officerSpeedFactor ?? 1;
    catchTime *= m.catchTimeFactor ?? 1;
  }
  return {
    ...level,
    obstacles: keep(level.obstacles),
    officers: keep(level.officers).map((o) => ({ ...o, visionRange: o.visionRange * vision, speed: o.speed * officerSpeed })),
    crowds: keep(level.crowds).map((c) => ({ ...c, size: Math.max(1, Math.round(c.size * crowdSize)) })),
    coins: keep(level.coins),
    bystanders: keep(level.bystanders),
    catchTimeFactor: catchTime,
  };
}
