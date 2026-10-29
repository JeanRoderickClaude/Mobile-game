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
  /** Trumpet: bystanders within this distance of Pip come and gather while he plays. */
  hearingRadius: number;
  /** Trumpet: noise meter gained per second of playing (1 = full). */
  noiseRisePerSec: number;
  /** Trumpet: noise meter lost per second of silence. */
  noiseFallPerSec: number;
  /** Trumpet: how long gathered bystanders stay with Pip after the music stops. */
  lingerMs: number;
  /** Trumpet: when the noise meter fills, officers within this distance come to look. */
  alertRadius: number;
  /** Night: an officer spots a player outside every lit pool only within this fraction of the cone's range. */
  darkRangeFactor: number;
  /** Night: how dark the screen is outside the light (0 clear .. 1 black). */
  darkness: number;
  /** Night: radius of the light the player sees around Pip. */
  pipLightRadius: number;
  /** Night: sound carries further, so the hearing and alert radii are multiplied by these. */
  nightHearingFactor: number;
  nightAlertFactor: number;
  /** Chase (levels with chaseMode): an officer chases at this fraction of Pip's top speed. */
  chaseSpeedFactor: number;
  /** Chase: a chasing officer alerts every officer within this distance, who join the chase. */
  chaseAlertRadius: number;
  /** Chase: the officer whose meter filled stands startled for this long (ms) before running. */
  chaseReactMs: number;
  /** Chase: an officer who joins a chase stands for this long (ms) before running; longer, so Pip gets a head start. */
  chaseJoinMs: number;
  /** Stamina (chaseMode levels): seconds of full-speed running from full to empty. Drain is proportional to the speed above crowd pace. */
  staminaDrainSec: number;
  /** Stamina: seconds from empty to full while walking at crowd pace or slower. */
  staminaRecoverSec: number;
  /** Stamina: recovery is this many times faster while hidden in a crowd or in darkness. */
  staminaRestFactor: number;
  /** Stamina: once empty, Pip's top speed is this fraction of his full speed (crowd pace is 0.6) until stamina is back to staminaResume. */
  staminaTiredFactor: number;
  staminaResume: number;
  /** Chase: after sight is lost the chasers keep running at chase speed toward Pip's projected position for this long (ms), then search. */
  chasePursuitMs: number;
  /** Search: the searchers project Pip's last seen heading this many seconds ahead (at his last seen speed, up to searchAheadMax units) and spread along that line. */
  searchAheadSec: number;
  searchAheadMax: number;
  /** Search: sideways spread (units) of the points beside the projected line and around the last seen spot. */
  searchSpread: number;
  /** Search: how long searching officers check their points before going back to patrol. */
  searchMs: number;
  /** Search: a searching officer only notices a hidden player (in a crowd at its pace, or in the dark at night) within this distance. */
  searchCloseRange: number;
}

// The "easy" key is kept so existing saves still load; players see it as Relaxed.
export const DIFFICULTIES = {
  easy: {
    label: 'Relaxed', catchTimeMs: 1500, visionRangeFactor: 0.8,
    hearingRadius: 230, noiseRisePerSec: 1 / 7, noiseFallPerSec: 1 / 4, lingerMs: 5500, alertRadius: 380,
    darkRangeFactor: 0.45, darkness: 0.62, pipLightRadius: 150, nightHearingFactor: 1.3, nightAlertFactor: 1.2,
    chaseSpeedFactor: 1.06, chaseAlertRadius: 240, chaseReactMs: 900, chaseJoinMs: 1600, chasePursuitMs: 2500, staminaDrainSec: 5, staminaRecoverSec: 8, staminaRestFactor: 2, staminaTiredFactor: 0.6, staminaResume: 0.25, searchAheadSec: 5, searchAheadMax: 800, searchSpread: 90, searchMs: 14000, searchCloseRange: 40,
  },
  normal: {
    label: 'Normal', catchTimeMs: 500, visionRangeFactor: 1,
    hearingRadius: 190, noiseRisePerSec: 1 / 4.5, noiseFallPerSec: 1 / 7, lingerMs: 4000, alertRadius: 520,
    darkRangeFactor: 0.5, darkness: 0.78, pipLightRadius: 120, nightHearingFactor: 1.3, nightAlertFactor: 1.3,
    chaseSpeedFactor: 1.08, chaseAlertRadius: 300, chaseReactMs: 600, chaseJoinMs: 1200, chasePursuitMs: 3000, staminaDrainSec: 4, staminaRecoverSec: 8, staminaRestFactor: 2, staminaTiredFactor: 0.6, staminaResume: 0.25, searchAheadSec: 6, searchAheadMax: 900, searchSpread: 100, searchMs: 12000, searchCloseRange: 55,
  },
} satisfies Record<string, DifficultyConfig>;

export type Difficulty = keyof typeof DIFFICULTIES;
/** New saves start here. */
export const DEFAULT_DIFFICULTY: Difficulty = 'normal';
/** Saves made before difficulties existed were played on Relaxed, so they keep it. */
export const LEGACY_DIFFICULTY: Difficulty = 'easy';
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
// the group's heading, speed is capped near the group's pace. The cap settles
// the player toward the group centre: pace x (1 - distance ahead of centre /
// ASSIST_SETTLE_DIST), kept between ASSIST_PACE_MIN and ASSIST_PACE_MAX (under
// HIDE_SPEED_MARGIN, so catching up still counts as hidden). In a standing
// group the cap is HIDE_SPEED_FLOOR times ASSIST_FLOOR_FACTOR. A joystick
// pushed to ASSIST_BREAK_STRENGTH or more, or the sprint key (Space), skips
// the cap.
export const ASSIST_ANGLE_DEG = 60;
export const ASSIST_SETTLE_DIST = 150;
export const ASSIST_PACE_MIN = 0.85;
export const ASSIST_PACE_MAX = 1.08;
export const ASSIST_FLOOR_FACTOR = 0.95;
export const ASSIST_BREAK_STRENGTH = 0.95;

// Trumpet and bystanders (the per-difficulty values live in DIFFICULTIES).
export const TRUMPET_SPEED_FACTOR = 0.5; // Pip walks at this fraction of top speed while playing
export const BYSTANDER_WANDER_SPEED = 18; // idle stroll around the home spot
export const BYSTANDER_FOLLOW_SPEED = 100; // walking to Pip and keeping up with him
export const BYSTANDER_RETURN_SPEED = 45; // drifting home after the linger time
export const GATHER_RING = 44; // gathered bystanders stand about this far from Pip
export const GATHER_DISTANCE = 70; // a drawn bystander counts as gathered within this distance of Pip
export const GATHER_MIN = 3; // gathered bystanders needed before they hide Pip
export const RING_INTERVAL_MS = 380; // a new sound ring leaves Pip this often while playing
export const RING_LIFE_MS = 900; // and grows to the hearing radius over this time
export const ALERT_SPEED_FACTOR = 1.6; // officers walk to the noise at this multiple of their patrol speed
export const ALERT_LOOK_MS = 3500; // and look around there this long before going back

// Commuters: gray-suited office workers, a slower kind of bystander.
export const COMMUTER_HEAR_MS = 1500; // music they must hear before they come over
export const COMMUTER_FOLLOW_SPEED = 60; // and how fast they walk to Pip and keep up

// Noir look for controlled ground (levels with "noir"). Gray areas get a
// grayscale copy with extra contrast; colour spreads from Pip while he plays.
export const NOIR_CONTRAST = 0.45; // added contrast in gray areas (0 = plain grayscale)
/** How much of the gray filter a painted dialogue backdrop gets in a gray scene (0 none, 1 full), so its neon and golden light survive. Drawn backdrops always get the full filter. */
export const PAINTED_GRAY_STRENGTH = 0.6;
export const NOIR_AURA_FACTOR = 0.75; // the colour glow around Pip reaches this fraction of the hearing radius
export const NOIR_AURA_GROW_MS = 500; // glow grows to full size this fast when playing starts
export const NOIR_AURA_FADE_MS = 1200; // and shrinks away this fast when it stops
export const NOIR_SPREAD_MS = 1400; // a won zone fills with colour from Pip's spot over this time

// Chase and search (levels with chaseMode; the per-difficulty values are in DIFFICULTIES).
export const SEARCH_POINTS = 3; // points checked around the last seen spot
export const SEARCH_RADIUS: [number, number] = [50, 110]; // how far from the last seen spot they are
export const SEARCH_SPEED_FACTOR = 1.0; // searchers jog between their points at this fraction of the chase speed
export const SEARCH_PAUSE_MS = 900; // a look around at each point
export const NOISE_WALK_FACTOR = 1.6; // a noise only calls officers whose walk to it is at most this times the alert radius
export const CHASE_REPATH_MS = 250; // a chasing officer re-plans its route this often
export const OFFICER_RADIUS = 12; // an officer touches Pip when centres are within PLAYER_RADIUS + this

// Stand-still tasks: posters (chapter 3) and tagging.
export const STAND_RADIUS = 30; // Pip's centre within this distance of a spot counts as at it
export const STAND_STILL_SPEED = 12; // and moving no faster than this counts as standing still
export const POSTER_MS = 2500; // standing still this long plants a poster
export const POSTER_ZONE = 180; // a planted poster colours a square this size around it

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
