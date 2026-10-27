# Protest Route (working title)

A top-down cartoon browser game. The player is a protestor who walks a route from a start point to a finish line without being caught by police. Runs in portrait on desktop and in phone browsers.

Live build: https://jeanroderickclaude.github.io/Mobile-game/ (redeployed on every push to `main`).

The live site is the owner's personal test build. When the owner asks for a feature to go live, merging it into `main` and pushing is approved.

## Commands

- `npm install` once.
- `npm run dev`: Vite dev server on port 5173, bound to all interfaces (`--host`). Open the "Network" address plus `/Mobile-game/` on a phone on the same Wi-Fi.
- `npm run typecheck`: TypeScript, no output.
- `npm run build`: typecheck plus production build into `dist/`. Asset paths start with `/Mobile-game/` (the `base` in `vite.config.ts`), so the build only works when served from that path.
- `npm run preview`: serves `dist/` at `http://localhost:4173/Mobile-game/`.

## Stack

- Phaser 4.2.1, Vite 8, TypeScript 7 (exact versions locked in `package-lock.json`).
- No image or audio files. Every visual is drawn in code with Phaser Graphics and shape objects.
- No physics engine. Movement, collision and line of sight are simple custom geometry (`src/systems/geometry.ts`).

## Folder structure

- `vite.config.ts`: base path `/Mobile-game/`, must match the repository name.
- `.github/workflows/deploy.yml`: on every push to `main`, runs `npm ci` and `npm run build` on Node 22 and publishes `dist/` to GitHub Pages.
- `index.html`: page shell, full-screen `#game` div, touch scrolling off.
- `src/main.ts`: Phaser game config (540x960 design size, `Scale.FIT`, centred, 2 touch pointers). Starts on the menu. Exposes `window.game` in dev only.
- `src/config.ts`: tuning constants (speeds, difficulties, crowd pace assist, character scale, colours).
- `src/scenes/MenuScene.ts`: first screen. Title, the equipped look, coin balance, Play (level 1) and Locker buttons, and an Easy / Normal difficulty switch. Enter or Space plays, L opens the locker.
- `src/scenes/LockerScene.ts`: the shop. Large character preview, Hats / Outfits / Signs tabs, item grid, Buy / Equip button. Escape or Back returns to the menu.
- `src/scenes/GameScene.ts`: loads a level, draws street and obstacles, player input and collision, detection, coins, HUD timer and coin counter, payout at the end.
- `src/scenes/ResultScene.ts`: "Caught" / "Route complete" overlay with the coin breakdown, Restart, "Next level" when one exists, and Menu. Enter, Space or R restart; Escape goes to the menu.
- `src/entities/Character.ts`: a protestor (player or crowd member), built from stacked layers. Crowd members are baked into one cached image.
- `src/entities/Crowd.ts`: marching and standing groups of protestors the player can hide in.
- `src/entities/cosmetics.ts`: tables of bodies (skin tones), outfits, hats and signs, the pools crowd members pick from, and the shape recipes that draw shop items.
- `src/entities/Coin.ts`: a coin on the street, its idle bob and pickup animation.
- `src/data/items.json`: the 12 shop items. `src/data/items.ts` describes and checks them.
- `src/systems/save.ts`: coin balance, owned and equipped items, mirrored to localStorage.
- `src/systems/economy.ts`: par time and finish bonus.
- `src/systems/sfx.ts`: coin pickup sound, synthesised with Web Audio.
- `src/ui/widgets.ts`: shared button, coin drawing and coin-count label.
- `src/entities/PoliceOfficer.ts`: patrol movement, facing, vision test, cone drawing.
- `src/systems/VirtualJoystick.ts`: floating touch joystick.
- `src/systems/geometry.ts`: ray-vs-rectangle, line of sight, angle helpers.
- `src/levels/*.json`: level data. `src/levels/types.ts` describes the format; `src/levels/index.ts` loads and checks it.
- `tools/`: balance tools. Node scripts that start Vite, load a level in headless Chromium and measure difficulty: crowd rides (with coins earned), blind solo runs, standing groups, good standing spots, a perfect-knowledge route search, a cone coverage map and coin risk. `tools/README.md` explains each and how to read the output. Run them after any level change.

## Design decisions

- Portrait, fixed 540x960 design resolution. The canvas scales to fit the screen with letterboxing. All level coordinates use these units.
- A level is as wide as the screen (540) and several screens tall (level 1: 2880, three screens). The camera follows the player vertically within the level bounds.
- Controls: arrow keys or WASD on desktop; hold Shift to walk at crowd pace (60 percent); hold Space to sprint out of crowd pace assist. On touch screens a joystick appears where the finger lands and follows the drag. Mouse dragging works too. Keyboard input wins when both are used.
- Difficulty: `DIFFICULTIES` in `config.ts` holds one object per difficulty with `catchTimeMs` and `visionRangeFactor` (multiplies every officer's `visionRange`). Easy: 1500 ms, cones 80 percent as long. Normal: 500 ms, full cones (the original balance). Easy is the default for new saves and for saves made before difficulties existed. The choice is saved and shown under the level name in the HUD. Coin values and the finish bonus are the same in both.
- Crowd pace assist (both difficulties): inside a marching group, with input within `ASSIST_ANGLE_DEG` (60) of the group's heading, speed is capped near the group's pace so the player stays hidden. The cap is pace times (1 - distance ahead of the group centre / 150), kept between 0.85 and 1.08, so a held push settles toward the middle instead of drifting out the front. In a standing group the cap is 95 percent of `HIDE_SPEED_FLOOR` (23.75 units/s). A joystick pushed to 95 percent or more of its radius, or holding Space, skips the cap. While the cap is holding the player back, a hint at the bottom says how to break cover.
- Buildings and parked cars are axis-aligned rectangles. They block movement and line of sight. The player collides as a square of half-size `PLAYER_RADIUS` (13 times `CHARACTER_SCALE`, so 16.25), resolved one axis at a time so it slides along walls.
- Detection: an officer sees the player when the player's centre is within `visionRange`, within half of `visionAngle` of the officer's facing, and the segment between them crosses no obstacle. A suspicion meter fills while any officer sees the player and drains at twice that speed otherwise. While the player is hidden in a crowd it fills at `HIDDEN_DETECTION_RATE` (25 percent). At the difficulty's `catchTimeMs` (Normal 500 ms, Easy 1500 ms) the player is caught. A red bar above the player shows the meter.
- Vision cones are drawn by casting `VISION_RAYS` rays per officer each frame, so the drawn cone is cut off by obstacles. What the player sees matches what the officer can see.
- Officers walk their waypoints at `speed`, wait `pauseMs` at each one, and turn smoothly toward the next leg (also while waiting). `loop` routes return to the first point; `pingpong` routes walk back.
- Levels are data. Every `src/levels/*.json` file is picked up by `import.meta.glob` and played in file-name order. Adding a level needs no code change; a "Next level" button appears after finishing when a next file exists. Bad data fails at startup with an error naming the file.
- Crowds: defined per level. Marching groups walk their `path` at `speed` (default 60 percent of `PLAYER_SPEED`, 102) in a loose two-wide column that turns with the path, fade out at the end, and a new group starts at the first point `intervalMs` later. Standing groups shuffle in place at `x, y`. Protestors block nothing: not movement, not line of sight. A faint disc shows each group's `radius` (default `CROWD_RADIUS`, 75).
- Hiding: the player is hidden while within a group's radius and moving no faster than `HIDE_SPEED_MARGIN` (1.1) times the group's speed, with a floor of `HIDE_SPEED_FLOOR` (25 units/s) so standing groups (speed 0) allow a slow shuffle. Player speed is measured after collision, so pushing into a wall counts as standing. A three-heads icon shows above the player while hidden.
- The player wears a magenta vest (`vest-magenta`, kept out of the crowd pools) and a white marker ring, so they stay visible in a crowd.
- Crowd members are baked: `Character` with `{ baked: true }` renders its layers once into a texture per look (2x resolution) and shows one image. This saves about 20 percent of frame time with 32 protestors. Baked members do not swing their hands.
- Character size: the player and officer containers are drawn at `CHARACTER_SCALE` (1.25). The art stays authored at base size. Collision and the suspicion bar offset scale with it. Vision cones start at the officer's centre, which scaling does not move. Level gaps the player must pass need to be at least 33 units wide (level 1's narrowest is 50).
- Cosmetics: the player is a `Container` with separate Graphics layers, bottom to top: body (hands), outfit, sign, head (uses the body's skin tone so it sits above the outfit), hat. `setBodyStyle`, `setOutfit`, `setSign` and `setHat` redraw one layer; `setLook` sets all. Items draw in local space, facing up, head at (0, 0). Signs are held ahead of the player and reach up to y -32, so baked textures cover -32..32. Crowd members never carry signs and never wear shop items, so the player stays unique.
- Frame time is capped at 50 ms per update, so a background tab does not teleport the player or officers.

## Economy

- Coins lie on the street, placed per level. Walking within `COIN_PICKUP_RADIUS` (26.25) of a coin's centre picks it up. A coin is worth its `value`, default `COIN_VALUE` (5). Coins worth more than 5 draw larger, in cyan with a star.
- Coins picked up in a run are held until the run ends. Finishing pays them out plus a speed bonus. Getting caught loses all of them; the Caught screen says how many.
- Speed bonus: `FINISH_BONUS_MAX` (40) at or under the level's par time, falling in a straight line to `FINISH_BONUS_MIN` (10) at `FINISH_SLOW_FACTOR` (3) times par and slower. Par is the level's `parTimeSec`, or by default its height walked at full speed times `PAR_TIME_FACTOR` (1.2): 20.3 s for level 1.
- Level 1 has 15 coins worth 135: 10 commons on the two crowd routes (5 per route), one at each standing group, and 3 valuable coins (25) in the side alleys at y 1350 and 1920 where officers sweep. Measured with `tools/ride.mjs` and `tools/coins.mjs`: riding a crowd collects its 5 route coins and never gets caught (24 of 24); a good run (joining the first group) earns 60 via crowd 0 (27.3 s, bonus 35) or 51 via crowd 1 (38.8 s, bonus 26). A blind solo dash from the nearest route to a valuable coin and back is caught on 28, 18 and 18 of 40 start times. Every valuable coin is at least 138 units from a crowd route, beyond the 75-unit crowd radius.
- Prices: cheapest about two good runs (120), most expensive about ten (600).
- Save data lives in localStorage under `protest-route.save.v1`: `{ "coins": 120, "owned": ["hat-bandana"], "equipped": { "hat": "hat-bandana", "outfit": "vest-magenta", "sign": "none" }, "difficulty": "easy" }`. A missing or unknown `difficulty` loads as Easy. Every read and write is wrapped in try/catch; if storage is blocked the game runs with progress kept in memory for the session. Loading drops unknown items, unowned equipped items and bad numbers. Bump the key's version when the shape changes incompatibly.
- Default items (beanie, magenta vest, no sign) are always owned, never listed in `owned`, and shown first in each locker tab.

## Shop item format

`src/data/items.json` is an array. Each entry:

```json
{ "id": "hat-bandana", "name": "Bandana", "category": "hat", "price": 120, "shape": "bandana", "color": "#c0392b", "accent": "#f4f4f4" }
```

- `id`: unique, stored in saves. Renaming one drops it from existing saves.
- `category`: `hat`, `outfit` or `sign` (the locker tabs).
- `price`: whole coins, above 0.
- `shape`: drawing recipe for that category. Hats: `bandana`, `beret`, `hardhat`, `crown`. Outfits: `tracksuit`, `jersey`, `poncho`, `cape`. Signs: `placard`, `lollipop`, `flag`, `banner`. Recipes live in `cosmetics.ts` (`HAT_SHAPES`, `OUTFIT_SHAPES`, `SIGN_SHAPES`) and take the two colours.
- `color`, `accent`: `#rrggbb`.

Adding an item with an existing shape is a JSON-only change. A new shape needs a recipe in `cosmetics.ts` and its name in `SHAPES` in `items.ts`. Bad entries fail at startup with an error naming the entry. The locker shows up to five tiles per tab (the default plus four items); more items per category need a scrolling grid.

## Level format (short)

```json
{
  "id": "level-02", "name": "Side Street", "width": 540, "height": 2880,
  "start": { "x": 270, "y": 2810 },
  "finish": { "x": 0, "y": 0, "width": 540, "height": 90 },
  "obstacles": [{ "type": "building", "x": 0, "y": 100, "width": 120, "height": 500, "color": "#c96f53" }],
  "officers": [{ "patrol": [{ "x": 150, "y": 2380 }, { "x": 390, "y": 2380 }],
                 "mode": "pingpong", "speed": 60, "pauseMs": 900, "visionRange": 200, "visionAngle": 70 }]
}
```

`color` is optional. Keep the start point outside every cone's reach. Leave at least 33 units for any gap the player must walk through.

Crowds are optional:

```json
"crowds": [
  { "type": "marching", "size": 8, "intervalMs": 6000, "delayMs": 0,
    "path": [{ "x": 205, "y": 2830 }, { "x": 205, "y": 20 }] },
  { "type": "standing", "size": 8, "x": 300, "y": 2220 }
]
```

`radius` (both types) and `speed` (marching) are optional. Members can overlap obstacles visually, so keep paths in open road where possible.

Coins and par time are optional:

```json
"parTimeSec": 20,
"coins": [{ "x": 205, "y": 2450 }, { "x": 60, "y": 1350, "value": 25 }]
```

Put common coins on crowd paths (within 26 units, so riding collects them). Put valuable coins more than 75 units from every crowd path and check them with `tools/coins.mjs`.

Level 1 balance on Normal (measured with the scripts in `tools/`): riding either marching group to the finish survived 24 of 24 runs across 12 cycles, with peak suspicion 124-464 ms of the 500 ms limit. Standing still alone at either standing group's spot gets caught (7.2 s and 0.5 s); standing in the group survives 90 s. Walking the marching routes alone at full speed survived 5 of 23 start times. A search with perfect timing still finds a solo route in about 27 s. Officers that walk the same direction as a crowd, just behind it, are what kill crowd runs: prefer crosswise sweeps with narrow cones (50 degrees) near crowd paths.

Level 1 by difficulty (`--difficulty normal` / `easy`):

| Check | Normal | Easy |
|---|---|---|
| ride.mjs, precise steering | 24 of 24, worst peak 464 of 500 ms | 24 of 24, worst peak 320 of 1500 ms |
| ride.mjs --assist, three-quarter push | 23 of 24, worst peak 500 ms | 24 of 24, worst peak 308 ms |
| blind.mjs crowd 0 route, full / 60 percent speed | 5 / 1 of 23 | 23 / 19 of 23 |
| blind.mjs crowd 1 route, full / 60 percent speed | 6 / 3 of 23 | 23 / 23 of 23 |
| coins.mjs valuable coins, solo dash caught | 28, 18, 18 of 40 | 5, 4, 2 of 40 |
| coins.mjs route coins, solo dash caught | 0 of 40 each | 0 of 40 each |

On Easy, walking the crowd routes alone at full speed always survives. That is the point of Easy for playtesting, but it means crowds and valuable coins carry little risk there.

## Testing

- Manual: walk into a cone (caught after about half a second), stand behind a building inside a cone's range (not caught), reach the finish (time shown).
- Difficulty and assist: with cleared storage the menu shows Easy selected. A catch takes about 1.5 s on Easy and 0.5 s on Normal. A three-quarter joystick push inside a marching group stays hidden at the group's pace; a full push breaks out.
- Economy: with cleared storage, collect coins and get caught (Caught screen states the loss, menu balance stays 0); finish a run (balance equals coins plus the stated bonus); buy and equip an item in the locker, start a run (the player wears it); reload (balance, owned and equipped survive).
- Balance: `node tools/ride.mjs src/levels/level-01.json` and the other scripts in `tools/` (see `tools/README.md`). Playwright 1.63.0 is a devDependency; on a new machine run `npx playwright install chromium` once.
- Other automated checks are ad hoc Playwright scripts against the dev server (`http://localhost:5173/Mobile-game/`), using `window.game.scene.getScene('game')` to place the player and freeze an officer. There is no test runner in the project yet.

## Not built yet

Sound beyond the coin pickup, a level select, more levels, skin tone choice, saving best times, police chasing or alert states beyond the catch meter, a pause or quit button during a run.
