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

export interface LevelData {
  id: string;
  name: string;
  width: number;
  height: number;
  start: Point;
  finish: Rect;
  obstacles: Obstacle[];
  officers: OfficerData[];
}
