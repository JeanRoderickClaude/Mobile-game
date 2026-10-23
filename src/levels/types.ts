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

export interface Obstacle extends Rect {
  type: 'building' | 'car';
  /** Optional hex colour such as "#c96f53". A palette colour is picked when left out. */
  color?: string;
}

export interface OfficerData {
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

interface CrowdBase {
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
}
