// Fixed design resolution. The canvas scales to fit the screen (Scale.FIT),
// so all game coordinates use these units regardless of device size.
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

// Characters (player and officers) are drawn at this multiple of their base
// art size. Collision and the suspicion meter offset scale with it.
export const CHARACTER_SCALE = 1.25;

export const PLAYER_SPEED = 170; // units per second
export const PLAYER_RADIUS = 13 * CHARACTER_SCALE; // collision half-size of the player box

// Difficulty settings. Everything that differs between difficulties lives
// here, one object each, so they can be tuned side by side.
export interface DifficultyConfig {
  label: string;
  /** How long the player must stay in sight before being caught. */
  catchTimeMs: number;
  /** Multiplies every officer's visionRange (cone length). */
  visionRangeFactor: number;
}

export const DIFFICULTIES = {
  easy: { label: 'Easy', catchTimeMs: 1500, visionRangeFactor: 0.8 },
  normal: { label: 'Normal', catchTimeMs: 500, visionRangeFactor: 1 },
} satisfies Record<string, DifficultyConfig>;

export type Difficulty = keyof typeof DIFFICULTIES;
export const DEFAULT_DIFFICULTY: Difficulty = 'easy';
// When out of sight, the suspicion meter drains at this multiple of the fill rate.
export const SUSPICION_DECAY = 2;

// Holding Shift on a keyboard walks at this fraction of top speed (crowd pace).
export const WALK_FACTOR = 0.6;

// Crowds of fellow protestors.
export const CROWD_SPEED_FACTOR = 0.6; // marching pace as a fraction of PLAYER_SPEED
export const CROWD_RADIUS = 75; // default "inside the group" distance from its centre
// Hidden in a crowd: detection fills at this fraction of the normal rate.
export const HIDDEN_DETECTION_RATE = 0.25;
// Hidden only while moving no faster than the group's speed times this margin...
export const HIDE_SPEED_MARGIN = 1.1;
// ...or no faster than this, so standing groups (speed 0) allow a slow shuffle.
export const HIDE_SPEED_FLOOR = 25;
// Crowd pace assist: inside a marching group with input within this angle of
// the group's heading, speed is capped at the group's pace times
// ASSIST_PACE_FACTOR (under HIDE_SPEED_MARGIN, so the player can slowly catch
// up while staying hidden). In a standing group the cap is HIDE_SPEED_FLOOR
// times ASSIST_FLOOR_FACTOR. A joystick pushed to ASSIST_BREAK_STRENGTH or
// more, or the sprint key (Space), skips the cap.
export const ASSIST_ANGLE_DEG = 60;
export const ASSIST_PACE_FACTOR = 1.05;
export const ASSIST_FLOOR_FACTOR = 0.95;
export const ASSIST_BREAK_STRENGTH = 0.95;

// Coins and the finish bonus.
export const COIN_VALUE = 5; // value of a coin whose level entry has no "value"
export const COIN_PICKUP_RADIUS = PLAYER_RADIUS + 10; // player centre to coin centre
// Finishing pays FINISH_BONUS_MAX at or under the level's par time, falling in a
// straight line to FINISH_BONUS_MIN at FINISH_SLOW_FACTOR times par and slower.
export const FINISH_BONUS_MAX = 40;
export const FINISH_BONUS_MIN = 10;
export const FINISH_SLOW_FACTOR = 3;
// Default par: walking the level's height at full speed, times this factor.
export const PAR_TIME_FACTOR = 1.2;

export const OFFICER_TURN_SPEED = 4; // radians per second
export const VISION_RAYS = 48; // rays used to draw each vision cone

export const COLORS = {
  background: 0x1d1f2b,
  road: 0x4a4d57,
  sidewalk: 0x8d8f99,
  laneMark: 0xe8e2c8,
  start: 0x3fae5a,
  finish: 0xf2c94c,
  building: [0xc96f53, 0xd9a05b, 0x7f9c96, 0xa77fb0, 0x6f8fc9],
  car: [0xe0524f, 0x4f8de0, 0xf0f0f0, 0x55b56a, 0xf2c94c],
  officer: 0x24407a,
  officerCap: 0x152649,
  cone: 0xfff3a0,
  coneAlert: 0xff4a4a,
  text: '#ffffff',
  coin: 0xf2c94c,
  coinRim: 0xb8901f,
  coinValuable: 0x5ce1e6,
  coinValuableRim: 0x1b8a9a,
};
