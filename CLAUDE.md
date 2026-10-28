# Protest Route (working title)

A top-down cartoon browser game. The player is a protestor who walks a route from a start point to a finish line without being caught by police. Runs in portrait on desktop and in phone browsers.

The game is a story mode in eight chapters. The story outline lives in `docs/story.md`: read it before writing chapters, levels or dialogue, and keep new content consistent with it (setting, characters, tone, the one-new-element-per-chapter rule, fixed chapter order).

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
- `src/config.ts`: tuning constants (speeds, difficulties including the trumpet settings, crowd pace assist, trumpet and bystander speeds, character scale, colours).
- `docs/story.md`: the story outline (setting, characters, the eight chapters, design rules).
- `src/scenes/MenuScene.ts`: first screen. Title, the equipped look, coin balance, Play (opens the chapter map) and Locker buttons, and an Easy / Normal difficulty switch. Enter or Space opens the chapter map, L opens the locker.
- `src/scenes/ChapterMapScene.ts`: the eight chapters by title with their state: Replay (done), Play (open), Coming soon (open but no level yet), Locked. Enter plays the furthest open chapter; Escape or Back returns to the menu.
- `src/scenes/DialogueScene.ts`: story dialogue on a side-on stage. Top half (y 0..480): a background strip (gray or colour by the scene's tone) and the scene's characters in full-body front view. Below it: the dialogue box with the speaker name and a colon, text and choice buttons; narration in italics with no name. Started standalone (intro) or as an overlay on the paused game (outro). Ends by starting or launching the scene it was given.
- `src/scenes/LockerScene.ts`: the shop. Large front-view character preview, Hats / Outfits / Signs tabs, item grid (tiles show items top-down, as they look in a run), Buy / Equip button. Escape or Back returns to the menu.
- `src/scenes/GameScene.ts`: loads a level with the story flags applied, draws street and obstacles, player input and collision, detection, coins, HUD timer and coin counter, payout at the end. In trumpet levels also the trumpet input (Space or the bottom-right button), sound rings, the noise meter and noise alerts. When started with a `chapterIndex` it marks the chapter done on finishing and plays its outro before the result.
- `src/scenes/ResultScene.ts`: "Caught" / "Route complete" overlay with the coin breakdown. In a chapter: Try again / Replay (skips the intro), "Next chapter" when the next one has a level, and Chapters. Outside a chapter (balance tools): Restart, "Next level" and Menu. Enter, Space or R restart; Escape leaves.
- `src/entities/Character.ts`: a protestor (player or crowd member), built from stacked layers. Top-down view for the game (crowd members are baked into one cached image) or front view (`{ view: 'front' }`) for the dialogue stage and the locker.
- `src/entities/Crowd.ts`: marching and standing groups of protestors the player can hide in.
- `src/entities/Bystanders.ts`: a level's idle locals and commuters. They wander near their spots, gather around Pip while he plays, linger, drift home, and form the gathered group that hides him.
- `src/entities/cosmetics.ts`: tables of bodies (skin tones), outfits, hats and signs, each with a top-down `draw` and a front-view `front`; cast-only outfits and hats (Quiet Squad uniform and cap, Gus's apron, Ruby's coat, the Mayor's suit, hair); the pools crowd members pick from; and the top-down and front-view shape recipes that draw shop items.
- `src/entities/Coin.ts`: a coin on the street, its idle bob and pickup animation.
- `src/data/items.json`: the 12 shop items. `src/data/items.ts` describes and checks them.
- `src/systems/save.ts`: coin balance, owned and equipped items, mirrored to localStorage.
- `src/systems/economy.ts`: par time and finish bonus.
- `src/systems/sfx.ts`: coin pickup sound, synthesised with Web Audio.
- `src/ui/widgets.ts`: shared button, coin drawing and coin-count label.
- `src/entities/PoliceOfficer.ts`: patrol movement, facing, vision test, cone drawing, and the noise alert (walk to a spot, look around, walk back) with a "?" above the officer.
- `src/systems/VirtualJoystick.ts`: floating touch joystick. Ignores touches that land on the trumpet button.
- `src/systems/geometry.ts`: ray-vs-rectangle, line of sight, angle helpers.
- `src/systems/noir.ts`: the gray, high-contrast look for controlled ground: the filtered world layer, colour zones, the colour mask and `noirMatrix` (also used by dialogue backdrops).
- `src/levels/*.json`: level data. `src/levels/types.ts` describes the format; `src/levels/index.ts` loads and checks it; `src/levels/resolve.ts` applies story flags (conditional entries, modifiers).
- `src/story/chapters.json`: the eight chapters in play order (id, title, level, intro, outro).
- `src/story/cast.json`: speakers for dialogue (name, name colour, what they wear on stage).
- `src/story/dialogue/*.json`: dialogue scenes; the file name is the scene id.
- `src/story/story.ts`: loads and checks chapters, cast and dialogue; chapter state (done / open / locked) and `startChapter`.
- `src/story/flags.ts`: story flag and condition types, `matches`.
- `tools/`: balance tools. Node scripts that start Vite, load a level in headless Chromium and measure difficulty: crowd rides (with coins earned), blind solo runs, standing groups, good standing spots, a perfect-knowledge route search, a cone coverage map, coin risk, and trumpet crossings and noise alerts (`trumpet.mjs`). `tools/README.md` explains each and how to read the output. Run them after any level change.

## Design decisions

- Portrait, fixed 540x960 design resolution. The canvas scales to fit the screen with letterboxing. All level coordinates use these units.
- A level is as wide as the screen (540) and several screens tall (level 1: 2880, three screens). The camera follows the player vertically within the level bounds.
- Controls: arrow keys or WASD on desktop; hold Shift to walk at crowd pace (60 percent); hold X to sprint out of crowd pace assist (Space does the same in levels without the trumpet). In trumpet levels hold Space to play; on touch screens a round trumpet button sits bottom right, opposite the joystick, and plays while held. On touch screens a joystick appears where the finger lands and follows the drag. Mouse dragging works too. Keyboard input wins when both are used.
- Difficulty: `DIFFICULTIES` in `config.ts` holds one object per difficulty with `catchTimeMs`, `visionRangeFactor` (multiplies every officer's `visionRange`) and the trumpet settings `hearingRadius`, `noiseRisePerSec`, `noiseFallPerSec`, `lingerMs` and `alertRadius`. Easy: 1500 ms, cones 80 percent as long; hearing 230, meter full after 7 s of playing and empty after 4 s of silence, linger 5.5 s, alert radius 380. Normal: 500 ms, full cones (the original balance); hearing 190, full after 4.5 s, empty after 7 s, linger 4 s, alert radius 520. Easy is the default for new saves and for saves made before difficulties existed. The choice is saved and shown under the level name in the HUD. Coin values and the finish bonus are the same in both.
- Crowd pace assist (both difficulties): inside a marching group, with input within `ASSIST_ANGLE_DEG` (60) of the group's heading, speed is capped near the group's pace so the player stays hidden. The cap is pace times (1 - distance ahead of the group centre / 150), kept between 0.85 and 1.08, so a held push settles toward the middle instead of drifting out the front. In a standing group the cap is 95 percent of `HIDE_SPEED_FLOOR` (23.75 units/s). A joystick pushed to 95 percent or more of its radius, or holding X (or Space in levels without the trumpet), skips the cap. While the cap is holding the player back, a hint at the bottom says how to break cover.
- Buildings and parked cars are axis-aligned rectangles. They block movement and line of sight. The player collides as a square of half-size `PLAYER_RADIUS` (13 times `CHARACTER_SCALE`, so 16.25), resolved one axis at a time so it slides along walls.
- Detection: an officer sees the player when the player's centre is within `visionRange`, within half of `visionAngle` of the officer's facing, and the segment between them crosses no obstacle. A suspicion meter fills while any officer sees the player and drains at twice that speed otherwise. While the player is hidden in a crowd it fills at `HIDDEN_DETECTION_RATE` (25 percent). At the difficulty's `catchTimeMs` (Normal 500 ms, Easy 1500 ms) the player is caught. A red bar above the player shows the meter.
- Vision cones are drawn by casting `VISION_RAYS` rays per officer each frame, so the drawn cone is cut off by obstacles. What the player sees matches what the officer can see.
- Officers walk their waypoints at `speed`, wait `pauseMs` at each one, and turn smoothly toward the next leg (also while waiting). `loop` routes return to the first point; `pingpong` routes walk back.
- Levels are data. Every `src/levels/*.json` file is picked up by `import.meta.glob`. Players reach a level through the chapter that names it in `chapters.json`. The balance tools still start levels by file-name index. Bad data fails at startup with an error naming the file.
- Story flow: Play → chapter map → chapter intro (if any) → level → on finishing, the chapter is saved as done, then the outro plays over the paused level, then the result screen. Getting caught shows the result screen with no outro. Chapter 1 is always open; each later chapter opens when the one before it is done. Finished chapters replay with full coin payout and play their intro and outro again (Skip ends them). A chapter with no `level` shows "Coming soon" once open.
- Dialogue stage: the scene's `stage` picks the backdrop (`street`, `harbor` or `cellar`, flat silhouettes; the street has a Drone and Partners billboard). The scene's `tone` grays the backdrop with `noirMatrix` or leaves it in colour; a line's `tone` fades it over 0.5 s. Characters always stay in colour. Characters stand with their feet on y 452, drawn in front view at 2.7 times base size. Pip always wears the player's equipped items and stands leftmost. The speaker steps 16 units forward and grows 7 percent at full brightness; everyone else dims to 42 percent brightness with a ColorMatrix filter (alpha on the canvas renderer). Narration, and speakers who are not on stage (the Mayor on a loudspeaker), dim everyone. A line's `enter` and `exit` walk characters on and off from the nearer screen edge in 450 ms.
- Dialogue box: sits under the stage from y 496 and keeps one height per scene, sized to the scene's longest line (measured when the scene opens), so it never changes height between lines. Text is 26px and wraps across the full box width (about 34 characters per row). The box ends 16 units above the bottom edge at most; in dev a scene whose longest line needs more logs a console warning. Choices stack under the box. Tap or Space/Enter advances; Skip or Escape jumps to the next choice ahead, or ends the scene when none is left, so choices cannot be skipped past. While a choice is showing, Skip and tap-to-advance are off; tap a button or press 1-4. Input is ignored for the first 300 ms so a lifted finger or held key from the level does not skip a line. Replaying a chapter and picking differently overwrites the flag.
- Crowds: defined per level. Marching groups walk their `path` at `speed` (default 60 percent of `PLAYER_SPEED`, 102) in a loose two-wide column that turns with the path, fade out at the end, and a new group starts at the first point `intervalMs` later. Standing groups shuffle in place at `x, y`. Protestors block nothing: not movement, not line of sight. A faint disc shows each group's `radius` (default `CROWD_RADIUS`, 75).
- Hiding: the player is hidden while within a group's radius and moving no faster than `HIDE_SPEED_MARGIN` (1.1) times the group's speed, with a floor of `HIDE_SPEED_FLOOR` (25 units/s) so standing groups (speed 0) allow a slow shuffle. Player speed is measured after collision, so pushing into a wall counts as standing. A three-heads icon shows above the player while hidden.
- Trumpet (levels with `"trumpet": true`): while playing, Pip walks at `TRUMPET_SPEED_FACTOR` (half) speed and a yellow sound ring leaves him every 380 ms, growing to the hearing radius, so the rings show who can hear. The noise meter (top centre of the HUD) rises at `noiseRisePerSec` while playing and falls at `noiseFallPerSec` otherwise. When it fills, every officer within `alertRadius` of Pip who can walk there in a straight line (obstacles grown by 14 units) comes to look, the meter empties and the screen flashes red. Playing itself is never seen; only the meter calls officers.
- Bystanders: idle locals placed per level (`bystanders`), drawn like protestors. They stroll within `wander` (default 25) of their spot at 18 units/s, block nothing and hide no one on their own. While Pip plays, those within `hearingRadius` walk over at `BYSTANDER_FOLLOW_SPEED` (100) and keep a spot on a 44-unit ring around him, also while he walks. When he stops, they stay with him for `lingerMs`, then drift home at 45 units/s; playing again draws them back. Idle wandering uses a seeded random source, so the balance tools repeat exactly.
- Gathered group: at least `GATHER_MIN` (3) drawn bystanders within 70 units of Pip form a group centred on them, shown as a faint disc. It hides Pip with the crowd rules: inside its 75-unit radius and not faster than 1.1 times its pace (100), so detection fills at 25 percent. Because the group walks with Pip, he stays hidden while walking at up to 110, which a strict standing-group rule (25 units/s) would not allow; that is what makes slipping past during the linger time possible. The crowd pace assist caps Pip at 95 inside the group, in any direction; X or a full joystick push breaks out.
- Noise alert: an alerted officer walks to the spot at 1.6 times patrol speed (turning as they go), sweeps the cone left and right there for `ALERT_LOOK_MS` (3.5 s), walks back to where they left the route, and resumes the patrol. A "?" shows above them while they walk there and look. Their cone works as normal throughout. This is deliberately simple; chasing and searching come in chapter 4.
- Commuters: bystanders with `"kind": "commuter"`, Drone and Partners office workers in gray suits (`gray-suit`, plain hair or a gray beanie). They need `COMMUTER_HEAR_MS` (1500) of music within hearing before they come over (what they have heard fades at the same rate when it stops) and walk at `COMMUTER_FOLLOW_SPEED` (60). A gathered group moves at its slowest member's pace, so with commuters in it Pip stays hidden only up to 66 units/s and the assist caps him at 57. Built for later chapters; no level uses them yet.
- Noir look (levels with `noir`): controlled ground is drawn gray and high-contrast, music colours it. Every world object except Pip, his suspicion bar and hidden icon, and the HUD sits in one Layer (depth 29, just under Pip). A ParallelFilters filter on the layer draws a gray copy (`noirMatrix`: equal-weight gray, `NOIR_CONTRAST` 0.45 extra contrast around mid-gray) with the original colours on top, cut by a mask of everything coloured: zones that start coloured, won zones, a soft glow around Pip while he plays (grows to 75 percent of the hearing radius in 0.5 s, fades over 1.2 s) and a fading disc behind each sound ring. The mask is a Graphics redrawn each frame at half resolution in screen space. A gray zone with `musicMs` turns coloured for the rest of the run once that much trumpet music has been played inside it, filling outward from Pip's spot over 1.4 s; a rainbow bar under the noise meter shows progress while Pip stands in one. Ground outside every zone is gray. Pip and everything he wears are always in colour. Phaser's `contrast()` writes matrix offsets in 0..1 although its ColorMatrix reads them in 0..255, so `noirMatrix` builds the matrix by hand. On the canvas renderer the level stays in colour.
- Noir cost: each frame `Noir` picks one of three setups by what the camera sees: the full mask-and-blend chain only when gray and colour share the screen, a single colour-matrix pass when the view is all gray, and no filter when a finished coloured zone covers the view. Measured in headless Chromium with iPhone 13 emulation, which renders WebGL in software (no GPU), so every full-screen pass costs far more than on a phone: before the filter 27 to 31 fps in all four test scenes; after it 20 to 24 fps when the view is all gray (level 2's quay standing still) and 15 to 18 fps when gray and colour mix (level 1's start, level 2 while playing or near a coloured zone). Re-measure on a real phone before adding more full-screen filters.
- The player wears a magenta vest (`vest-magenta`, kept out of the crowd pools) and a white marker ring, so they stay visible in a crowd.
- Crowd members are baked: `Character` with `{ baked: true }` renders its layers once into a texture per look (2x resolution) and shows one image. This saves about 20 percent of frame time with 32 protestors. Baked members do not swing their hands.
- Character size: the player and officer containers are drawn at `CHARACTER_SCALE` (1.25). The art stays authored at base size. Collision and the suspicion bar offset scale with it. Vision cones start at the officer's centre, which scaling does not move. Level gaps the player must pass need to be at least 33 units wide (level 1's narrowest is 50).
- Cosmetics: the player is a `Container` with separate Graphics layers, bottom to top: body (hands), outfit, sign, head (uses the body's skin tone so it sits above the outfit), hat. The front view has the same layers in the order sign, body (trousers, shoes, hands), outfit, head (with a face), hat, with the feet at (0, 0); its coordinates are described at the top of `cosmetics.ts`. `setBodyStyle`, `setOutfit`, `setSign` and `setHat` redraw one layer; `setLook` sets all. Items draw in local space, facing up, head at (0, 0). Signs are held ahead of the player and reach up to y -32, so baked textures cover -32..32. Crowd members never carry signs and never wear shop items, so the player stays unique.
- Frame time is capped at 50 ms per update, so a background tab does not teleport the player or officers.

## Economy

- Coins lie on the street, placed per level. Walking within `COIN_PICKUP_RADIUS` (26.25) of a coin's centre picks it up. A coin is worth its `value`, default `COIN_VALUE` (5). Coins worth more than 5 draw larger, in cyan with a star.
- Coins picked up in a run are held until the run ends. Finishing pays them out plus a speed bonus. Getting caught loses all of them; the Caught screen says how many.
- Speed bonus: `FINISH_BONUS_MAX` (40) at or under the level's par time, falling in a straight line to `FINISH_BONUS_MIN` (10) at `FINISH_SLOW_FACTOR` (3) times par and slower. Par is the level's `parTimeSec`, or by default its height walked at full speed times `PAR_TIME_FACTOR` (1.2): 20.3 s for level 1.
- Level 1 has 15 coins worth 135: 10 commons on the two crowd routes (5 per route), one at each standing group, and 3 valuable coins (25) in the side alleys at y 1350 and 1920 where officers sweep. Measured with `tools/ride.mjs` and `tools/coins.mjs`: riding a crowd collects its 5 route coins and never gets caught (24 of 24); a good run (joining the first group) earns 60 via crowd 0 (27.3 s, bonus 35) or 51 via crowd 1 (38.8 s, bonus 26). A blind solo dash from the nearest route to a valuable coin and back is caught on 28, 18 and 18 of 40 start times. Every valuable coin is at least 138 units from a crowd route, beyond the 75-unit crowd radius.
- Prices: cheapest about two good runs (120), most expensive about ten (600).
- Save data lives in localStorage under `protest-route.save.v2`: `{ "coins": 120, "owned": ["hat-bandana"], "equipped": { "hat": "hat-bandana", "outfit": "vest-magenta", "sign": "none" }, "difficulty": "easy", "completed": ["ch1"], "flags": { "helpedRuby": true } }`. `completed` holds finished chapter ids; `flags` holds story flags (choices are stored as the flags they set). When v2 is missing, a `protest-route.save.v1` save is loaded, given empty `completed` and `flags`, and written to v2; the v1 key is left in place. A missing or unknown `difficulty` loads as Easy. Every read and write is wrapped in try/catch; if storage is blocked the game runs with progress kept in memory for the session. Loading drops unknown items, unowned equipped items and bad numbers. Bump the key's version when the shape changes incompatibly.
- Default items (beanie, magenta vest, no sign) are always owned, never listed in `owned`, and shown first in each locker tab.

## Shop item format

`src/data/items.json` is an array. Each entry:

```json
{ "id": "hat-bandana", "name": "Bandana", "category": "hat", "price": 120, "shape": "bandana", "front": "bandana", "color": "#c0392b", "accent": "#f4f4f4" }
```

- `id`: unique, stored in saves. Renaming one drops it from existing saves.
- `category`: `hat`, `outfit` or `sign` (the locker tabs).
- `price`: whole coins, above 0.
- `shape`: top-down drawing recipe for that category, used in the game. Hats: `bandana`, `beret`, `hardhat`, `crown`. Outfits: `tracksuit`, `jersey`, `poncho`, `cape`. Signs: `placard`, `lollipop`, `flag`, `banner`. Recipes live in `cosmetics.ts` (`HAT_SHAPES`, `OUTFIT_SHAPES`, `SIGN_SHAPES`) and take the two colours.
- `front`: front-view drawing recipe, used on the dialogue stage and in the locker preview. The names match the `shape` list; recipes live in `FRONT_HAT_SHAPES`, `FRONT_OUTFIT_SHAPES` and `FRONT_SIGN_SHAPES`. Usually the same as `shape`, but any pairing is allowed.
- `color`, `accent`: `#rrggbb`.

Adding an item with existing shapes is a JSON-only change. A new shape needs a top-down recipe and a front-view recipe in `cosmetics.ts`, and its name in `SHAPES` and `FRONT_SHAPES` in `items.ts`. Built-in items (the defaults, crowd clothes, cast clothes) are tables in `cosmetics.ts` where every entry has `draw` (top-down) and `front`. Bad entries fail at startup with an error naming the entry. The locker shows up to five tiles per tab (the default plus four items); more items per category need a scrolling grid.

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

`color` is optional. A building with `"style": "water"` draws as harbor water with a quay edge; it still blocks sight like a building, so keep it at the level edge. Keep the start point outside every cone's reach. Leave at least 33 units for any gap the player must walk through.

Crowds are optional:

```json
"crowds": [
  { "type": "marching", "size": 8, "intervalMs": 6000, "delayMs": 0,
    "path": [{ "x": 205, "y": 2830 }, { "x": 205, "y": 20 }] },
  { "type": "standing", "size": 8, "x": 300, "y": 2220 }
]
```

`radius` (both types) and `speed` (marching) are optional. Members can overlap obstacles visually, so keep paths in open road where possible.

Any obstacle, officer, crowd or coin entry can carry `"if"` (see Story flags below) and is only placed when it matches. Story-dependent tuning goes in `modifiers`:

```json
"modifiers": [
  { "if": { "gaveNames": true }, "crowdSizeFactor": 0.6 },
  { "if": { "taggedVan": true }, "visionRangeFactor": 1.15, "officerSpeedFactor": 1.1, "catchTimeFactor": 0.8 }
]
```

Every matching modifier applies and factors multiply. `crowdSizeFactor` scales every crowd's `size` (rounded, at least 1); `visionRangeFactor` and `officerSpeedFactor` scale every officer; `catchTimeFactor` scales the difficulty's catch time (below 1 is more alert police). Unknown fields fail at startup. The balance tools run with an empty save, so they measure the level with no flags set; pass `flags` in the `game` scene data to test a variant.

The trumpet and bystanders are optional:

```json
"trumpet": true,
"bystanders": [{ "x": 170, "y": 2560 }, { "x": 240, "y": 2470, "wander": 40 }],
"finishLabel": "CELLAR"
```

`bystanders` need `"trumpet": true` (startup fails otherwise) and can carry `"if"` and `"kind": "commuter"`. Give players a quiet spot with bystanders and no officer within the Normal `alertRadius` (520) to try the trumpet. Bystanders walk straight to Pip and slide along obstacles, so place them in open ground. `finishLabel` replaces "FINISH" in the finish zone.

The noir look is optional:

```json
"noir": { "zones": [
  { "x": 0, "y": 1990, "width": 540, "height": 890, "start": "gray", "musicMs": 3000 },
  { "x": 230, "y": 0, "width": 80, "height": 430, "start": "color" }
] }
```

Without `noir` the level is all colour. With it, ground outside every zone is gray. `start` is `gray` or `color`. `musicMs` (gray zones only, trumpet levels only) is the trumpet time inside the zone that turns it coloured for the rest of the run; without it a gray zone stays gray. Zones may overlap; colour wins. Level 1: the busking corner at the start (y 2680 to 2880) is coloured, the rest gray. Level 2: quay, stalls and square are gray zones won after 3, 4 and 6 s of music; the cellar door gap is coloured.

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

Level 2 ("Harbor Quay", chapter 2): water along the left edge, a quiet quay (y 2880 to 2000) with five bystanders and no officer within alert range, a stretch of fish stalls (y 2000 to 1350) with two sideways patrols and three bystanders, then the guarded square in front of the fish auction (y 1300 to 450): six bystanders along its bottom edge, no crowds, and five officers on sideways sweeps (two on crossing lines at y 1160 and 1090, a loop around the fountain, short sweeps either side of the fountain) plus one across the top at y 560. The finish is the 80-unit door gap in the auction hall. 8 common coins on the main route (40) and 3 valuable ones (25 each) off it: by the stalls at the water's edge, in the square's left side and its bottom-right corner, each a detour that costs trumpet time. Par time 32 s.

Level 2 measured with `tools/trumpet.mjs` (23 start times, from the square's bottom edge at 270,1330 to the finish; left lane past the fountain, then right lane):

| Check | Normal | Easy |
|---|---|---|
| alone, full speed, no trumpet (left / right lane) | 6 / 2 of 23 | 22 / 23 of 23 |
| gather, then move in the linger time | 19 / 17 of 23 | 23 / 23 of 23 |
| play nonstop while crossing | 0 / 0 of 23, officers called in 19 / 20 | 23 / 23 of 23, officers called in 23 / 23 |
| hold until full at the quay practice spot (290,2450) | full after 4.5 s, nobody called (0 of 10) | full after 7 s, nobody called |
| hold until full by the stalls (270,1650), square edge (270,1330), in the square (200,900) | officers called and reached the spot in 10 of 10 each, all back on patrol | same, 10 of 10 |
| whole level from the start, gathering (12 start times) | 11 of 12, 33.5 s, 40 coins (alone: 2 of 12) | 12 of 12 (alone: 11 of 12) |
| gather detour to the valuable coin at 105,770 / 440,1240 | 18 / 20 of 23 | 23 / 23 of 23 |

Most gather failures are caught at the y 1090 line, which a player watching the cones can time; the tool walks blind. On Easy every way across survives, including playing nonstop while officers come, so the trumpet carries little risk there, as with crowds in level 1. A good run (all 8 common coins, about 34 s against par 32) earns about 79; each valuable coin adds 25.

## Story data

Chapters (`src/story/chapters.json`), in play order:

```json
{ "id": "ch1", "title": "Last Song", "level": "level-01", "intro": "ch1-intro", "outro": "ch1-outro" }
```

`id` is stored in saves; renaming one drops that chapter's progress. `level` is a level `id`; leave it out until the level exists. `intro` and `outro` are optional dialogue ids, or a list of variants where the first whose `if` matches plays (for chapter 8's three endings):

```json
"outro": [{ "scene": "ch8-end-full", "if": { "helpedRuby": true, "gaveNames": false } }, { "scene": "ch8-end-small" }]
```

Cast (`src/story/cast.json`), keyed by speaker id: `{ "hush": { "name": "Sgt. Hush", "color": "#a9b8d6", "look": { "body": "light", "outfit": "squad-uniform", "hat": "squad-cap" } } }`. The name is shown as "Sgt. Hush:" in `color`. `look` takes any of `body`, `outfit`, `hat`, `sign` (ids from the tables in `cosmetics.ts`); left-out parts are light skin, grey tee, no hat, no sign. `pip` must exist; Pip has no `look` and always wears the player's equipped items.

Dialogue (`src/story/dialogue/<id>.json`):

```json
{
  "stage": "cellar",
  "cast": [{ "id": "pip", "x": 110 }, { "id": "ruby", "x": 290 }, { "id": "hush", "x": 440, "offstage": true }],
  "lines": [
    { "speaker": "hush", "text": "Nobody move. Nobody hum.", "enter": ["hush"] },
    { "speaker": "ruby", "text": "Grab the tuba or run, kid!", "choices": [
      { "text": "Carry the tuba", "set": { "helpedRuby": true } },
      { "text": "Run", "set": { "helpedRuby": false } }
    ] },
    { "speaker": "ruby", "text": "Mind the bell.", "if": { "helpedRuby": true } },
    { "text": "Behind them, the Cellar door slams shut." }
  ]
}
```

`tone` (optional, default `color`) is the backdrop's look at the start: `gray` for the Quiet Squad's streets and Drone and Partners, `color` for music places; any line can carry `"tone"` to switch it (chapter 1's intro goes gray when the Squad arrives, its outro back to colour on the tuba note). `stage` is `street`, `harbor` or `cellar` (drawn in `drawStage` in `DialogueScene.ts`; a new backdrop needs a branch there and its name in `STAGES` in `story.ts`). `cast` lists everyone who appears on stage in the scene, with the centre `x` of their spot (40 to 500); four characters fit at about 120 apart. Pip must be leftmost. `offstage: true` starts a character off stage. A line's `enter` and `exit` list cast ids that walk on or off before the line shows; every id must be in the scene's `cast`. Skip applies the moves of the lines it passes, so a choice sees the right stage.

Each line needs `text`. `speaker` is a cast id; leave it out for narration (italic, no name). `choices` (2 to 4) each set one or more flags when picked. A line with `if` is skipped unless it matches, checked when the scene reaches it, so a choice can decide the lines after it. Write dialogue by the style guide in `docs/story.md` (12 to 16 lines per scene, one to three sentences per line, Pip's thoughts in brackets). Bad data fails at startup naming the file and line.

## Story flags

Flags are named values: `true`, `false`, a number or a string. Dialogue choices set them; levels, dialogue lines and chapter scene variants read them. A condition is an object of flag names to values, and matches when every listed flag equals its value: `{ "helpedRuby": true, "alertness": 2 }`. A flag that was never set reads as `false`, so `{ "gaveNames": false }` also matches before the choice was made. Flags persist in the save and are never cleared by replaying. Use camelCase names and add each new flag to the list below.

Flags in use: none yet. Planned in `docs/story.md`: `taggedVan` (ch3), `helpedRuby` (ch4), `gaveNames` (ch6).

## Testing

- Manual: walk into a cone (caught after about half a second), stand behind a building inside a cone's range (not caught), reach the finish (time shown).
- Difficulty and assist: with cleared storage the menu shows Easy selected. A catch takes about 1.5 s on Easy and 0.5 s on Normal. A three-quarter joystick push inside a marching group stays hidden at the group's pace; a full push breaks out.
- Economy: with cleared storage, collect coins and get caught (Caught screen states the loss, menu balance stays 0); finish a run (balance equals coins plus the stated bonus); buy and equip an item in the locker, start a run (the player wears it); reload (balance, owned and equipped survive).
- Story: with a v1 save holding coins and an item, reload: coins and item survive and a v2 key appears. The chapter map shows chapter 1 open and 2 to 8 locked. Playing chapter 1 shows the intro; Skip starts the level; finishing plays the outro, then the result; chapter 1 shows Replay and chapter 2 Play. Replaying still pays coins. A dialogue with a choice stops Skip at the choice, saves the flag, and the flag survives a reload. In an emulated phone (Playwright `devices['iPhone 13']`), with a hat, outfit and sign equipped, read every line: Pip wears all three on the stage, the speaker is the only one at full brightness (none on narration), the box height never changes within a scene, speaker names end with a colon, narration is italic with no name, text stays above "Tap to continue", and the Stranger walks on in the outro. In the locker, every item previews in front view.
- Trumpet (chapter 2, emulated phone): hold the trumpet button in the quiet stretch; bystanders walk over, rings spread and the meter rises. Release; they stay around Pip for the linger time, then walk home. Hold next to the fish stalls until the meter fills; nearby officers show "?", walk to the spot, look around and return to their patrol. Gather at the square's bottom edge and cross with the group. Finishing plays the outro in the cellar and the chapter map shows chapter 3 as "Coming soon".
- Noir (chapter 2, emulated phone): the quay starts gray; while Pip plays, colour spreads around him (a coin next to him turns yellow, a crate further away stays gray); after 3 s of music the quay stays coloured when he stops; the stalls are still gray; Pip's equipped hat, outfit and sign stay in colour everywhere. Dialogue: chapter 1's intro is in colour until the Squad arrives and gray after, its outro is gray until the last line; chapter 2's harbor is gray and the cellar in colour; the street billboard reads "DRONE & PARTNERS / Focus pays."; Officer Mute mentions Drone and Partners in chapter 2.
- Balance: `node tools/ride.mjs src/levels/level-01.json` and the other scripts in `tools/` (see `tools/README.md`). Playwright 1.63.0 is a devDependency; on a new machine run `npx playwright install chromium` once.
- Other automated checks are ad hoc Playwright scripts against the dev server (`http://localhost:5173/Mobile-game/`), using `window.game.scene.getScene('game')` to place the player and freeze an officer. There is no test runner in the project yet.

## Not built yet

Chapters 3 to 8 (levels, mechanics, dialogue), sound beyond the coin pickup, final character art (front views are placeholder shapes), skin tone choice, saving best times, police chasing and searching (chapter 4; the chapter 2 noise alert only walks to a spot and back), a pause or quit button during a run.
