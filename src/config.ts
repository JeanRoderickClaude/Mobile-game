// Fixed design resolution. The canvas scales to fit the screen (Scale.FIT),
// so all game coordinates use these units regardless of device size.
export const GAME_WIDTH = 540;
export const GAME_HEIGHT = 960;

export const PLAYER_SPEED = 170; // units per second
export const PLAYER_RADIUS = 13; // collision half-size of the player box

// How long the player must stay in sight before being caught.
export const CATCH_TIME_MS = 500;
// When out of sight, the suspicion meter drains at this multiple of the fill rate.
export const SUSPICION_DECAY = 2;

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
