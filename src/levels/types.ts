import type { Condition } from '../story/flags';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Any level entry with "if" is only placed when the story flags match (see src/story/flags.ts). */
interface Conditional {
  if?: Condition;
}

export interface Obstacle extends Rect, Conditional {
  type: 'building' | 'car';
  /** Optional hex colour such as "#c96f53". A palette colour is picked when left out. */
  color?: string;
  /** Optional drawing style for buildings. "water" draws a harbor basin; it still blocks like a building, so keep it at the level edge. */
  style?: 'water';
}

export interface OfficerData extends Conditional {
  /** Waypoints in world units. The officer starts at the first one. */
  patrol: Point[];
  /** "loop" returns from the last point to the first; "pingpong" walks back along the route. */
  mode: 'loop' | 'pingpong';
  speed: number;
  /** Wait at each waypoint, in milliseconds. */
  pauseMs: number;
  visionRange: number;
  /** Full cone width in degrees. */
  visionAngle: number;
}

interface CrowdBase extends Conditional {
  /** Number of protestors in the group. */
  size: number;
  /** The player counts as inside the group within this distance of its centre. Default CROWD_RADIUS. */
  radius?: number;
}

/** A group that walks a path, vanishes at its end and starts again after intervalMs. */
export interface MarchingCrowdData extends CrowdBase {
  type: 'marching';
  path: Point[];
  /** Units per second. Default is CROWD_SPEED_FACTOR of the player's top speed. */
  speed?: number;
  /** Wait between a group vanishing at the end and the next one starting. */
  intervalMs: number;
  /** Wait before the first group starts. Default 0. */
  delayMs?: number;
}

/** A group gathered at a fixed spot, shuffling in place. */
export interface StandingCrowdData extends CrowdBase {
  type: 'standing';
  x: number;
  y: number;
}

export type CrowdData = MarchingCrowdData | StandingCrowdData;

/** An idle local who wanders near a spot and comes to listen when Pip plays the trumpet. */
export interface BystanderData extends Point, Conditional {
  /** How far from the spot they stroll while idle. Default 25. */
  wander?: number;
  /** "local" (default) or "commuter": a gray-suited office worker who needs COMMUTER_HEAR_MS of music before coming over and walks at COMMUTER_FOLLOW_SPEED. */
  kind?: 'local' | 'commuter';
}

/** A rectangle of the level for the noir look. Ground outside every zone is gray. */
export interface NoirZone extends Rect {
  /** "gray" or "color" at the start of a run. */
  start: 'gray' | 'color';
  /** For gray zones: ms of trumpet music played inside it that turn it coloured for the rest of the run. Left out: it stays gray. */
  musicMs?: number;
}

/** A coin lying on the street. Collected by walking over it. */
export interface CoinData extends Point, Conditional {
  /** Coins added to the run when picked up. Default COIN_VALUE (5). Higher values draw as valuable coins. */
  value?: number;
}

/**
 * Tuning applied when the story flags match. Every matching modifier applies;
 * factors multiply. Left-out factors are 1.
 */
export interface LevelModifier extends Conditional {
  /** Multiplies every crowd's size (rounded, at least 1). */
  crowdSizeFactor?: number;
  /** Multiplies every officer's visionRange. */
  visionRangeFactor?: number;
  /** Multiplies every officer's walking speed. */
  officerSpeedFactor?: number;
  /** Multiplies the difficulty's catch time. Below 1 means more alert police. */
  catchTimeFactor?: number;
}

export const MODIFIER_FACTORS = ['crowdSizeFactor', 'visionRangeFactor', 'officerSpeedFactor', 'catchTimeFactor'] as const;

export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  start: Point;
  finish: Rect;
  obstacles: Obstacle[];
  officers: OfficerData[];
  /** Optional. Fellow protestors the player can hide among. */
  crowds?: CrowdData[];
  /** Optional. Coins to pick up during a run. */
  coins?: CoinData[];
  /** Optional. Pip can play the trumpet (Space or the on-screen button). Default false. */
  trumpet?: boolean;
  /** Optional. Locals who gather around Pip while he plays. */
  bystanders?: BystanderData[];
  /** Optional. Text drawn in the finish zone. Default "FINISH". */
  finishLabel?: string;
  /** Optional. Draws controlled ground gray and high-contrast; see src/systems/noir.ts. Without it the level is all colour. */
  noir?: { zones: NoirZone[] };
  /** Optional. Finish time in seconds that earns the full speed bonus. Default: height / PLAYER_SPEED x PAR_TIME_FACTOR. */
  parTimeSec?: number;
  /** Optional. Story-flag dependent tuning, applied by resolveLevel. */
  modifiers?: LevelModifier[];
}

/** A level with its story flags applied: conditional entries removed, modifiers folded in. */
export interface ResolvedLevel extends LevelData {
  /** Product of the matching modifiers' catchTimeFactor. */
  catchTimeFactor: number;
}
