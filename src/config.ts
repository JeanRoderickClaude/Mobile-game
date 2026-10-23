// Fixed design resolution. The canvas scales to fit the screen (Scale.FIT),
// so all game coordinates use these units regardless of device size.
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

// Characters (player and officers) are drawn at this multiple of their base
// art size. Collision and the suspicion meter offset scale with it.
export const CHARACTER_SCALE = 1.25;

export const PLAYER_SPEED = 170; // units per second
export const PLAYER_RADIUS = 13 * CHARACTER_SCALE; // collision half-size of the player box

// How long the player must stay in sight before being caught.
export const CATCH_TIME_MS = 500;
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
};
