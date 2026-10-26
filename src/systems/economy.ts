import { FINISH_BONUS_MAX, FINISH_BONUS_MIN, FINISH_SLOW_FACTOR, PAR_TIME_FACTOR, PLAYER_SPEED } from '../config';
import type { LevelData } from '../levels/types';

/** Finish time that earns the full speed bonus: the level's parTimeSec, or its height at full speed plus 20 percent. */
export function parTimeMs(level: LevelData): number {
  return level.parTimeSec !== undefined ? level.parTimeSec * 1000 : (level.height / PLAYER_SPEED) * PAR_TIME_FACTOR * 1000;
}

/** Speed bonus for finishing in elapsedMs: full at par, falling linearly to the minimum at FINISH_SLOW_FACTOR x par. */
export function finishBonus(elapsedMs: number, level: LevelData): number {
  const par = parTimeMs(level);
  const slow = par * FINISH_SLOW_FACTOR;
  const t = Math.min(1, Math.max(0, (slow - elapsedMs) / (slow - par)));
  return Math.round(FINISH_BONUS_MIN + (FINISH_BONUS_MAX - FINISH_BONUS_MIN) * t);
}
