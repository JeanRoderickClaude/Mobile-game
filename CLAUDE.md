# Protest Route (working title)

A top-down cartoon browser game. The player is a protestor who walks a route from a start point to a finish line without being caught by police. Runs in portrait on desktop and in phone browsers.

The game is a story mode in eight chapters. The story outline lives in `docs/story.md`: read it before writing chapters, levels or dialogue, and keep new content consistent with it (setting, characters, tone, the one-new-element-per-chapter rule, fixed chapter order).

Live build: https://jeanroderickclaude.github.io/Mobile-game/ (redeployed on every push to `main`).

The live site is the owner's personal test build. When the owner asks for a feature to go live, merging it into `main` and pushing is approved.

## Reporting

At the end of every task, put the full final report inside a single code block, so the owner can copy it in one tap.

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
- `src/scenes/MenuScene.ts`: first screen. Title, the equipped look, coin balance, Play (opens the chapter map) and Locker buttons, and a Relaxed / Normal difficulty switch with the note "Normal is the intended experience. Relaxed is more forgiving." under it. Enter or Space opens the chapter map, L opens the locker. A small Practice button (top right) starts the chase practice level; the build setting `VITE_PRACTICE_LEVEL=off` hides it. A "Show FPS: Off / On" switch (top left, off by default, saved as `showFps`) shows the frame rate in the bottom left corner of every level (`GameScene`, updated about 2.5 times a second from `game.loop.actualFps`).
- `src/scenes/ChapterMapScene.ts`: the eight chapters by title with their state: Replay (done), Play (open), Coming soon (open but no level yet), Locked. Enter plays the furthest open chapter; Escape or Back returns to the menu.
- `src/scenes/DialogueScene.ts`: story dialogue on a side-on stage. Top half (y 0..480): a background strip (gray or colour by the scene's tone) and the scene's characters in full-body front view. Below it: the dialogue box with the speaker name and a colon, text and choice buttons; narration in italics with no name. Started standalone (intro) or as an overlay on the paused game (outro). Ends by starting or launching the scene it was given.
- `src/scenes/LockerScene.ts`: the shop. Large front-view character preview, Hats / Outfits / Signs / Hair tabs, item grid of up to eight tiles (each tile is the front-view character wearing the item, at 0.95 scale, so it matches the large preview), Buy / Equip button. Escape or Back returns to the menu.
- `src/scenes/GameScene.ts`: loads a level with the story flags applied, draws street and obstacles, player input and collision, detection, coins, HUD timer and coin counter, payout at the end. In trumpet levels also the trumpet input (Space or the bottom-right button), sound rings, the noise meter and noise alerts. At night also the lamps and the darkness overlay; with posters the poster count, the closed finish and tag flags (set on finishing). When started with a `chapterIndex` it marks the chapter done on finishing and plays its outro before the result.
- `src/scenes/ResultScene.ts`: "Caught" / "Route complete" overlay with the coin breakdown. In a chapter: Try again / Replay (skips the intro), "Next chapter" when the next one has a level, and Chapters. Outside a chapter (balance tools): Restart, "Next level" and Menu. Enter, Space or R restart; Escape leaves.
- `src/entities/Character.ts`: a protestor (player or crowd member), built from stacked layers. Top-down view for the game (crowd members are baked into one cached image) or front view (`{ view: 'front' }`) for the dialogue stage and the locker.
- `src/entities/Crowd.ts`: marching and standing groups of protestors the player can hide in.
- `src/entities/Bystanders.ts`: a level's idle locals and commuters. They wander near their spots, gather around Pip while he plays, linger, drift home, and form the gathered group that hides him.
- `src/entities/cosmetics.ts`: tables of bodies (skin tones), outfits, hats and signs, each with a top-down `draw` and a front-view `front`; the hairstyles (`HAIRSTYLES`: buzz, spiky, mohawk, bob, long, curly, ponytail, bun) and hair colours (`HAIR_COLORS`); cast-only outfits and hats (Quiet Squad uniform and cap, Gus's apron, Ruby's coat, the Mayor's suit); the pool of looks crowd members pick from; and the top-down and front-view shape recipes that draw shop items.
- `src/entities/Coin.ts`: a coin on the street, its idle bob and pickup animation.
- `src/entities/ink.ts`: the comic look for drawn characters: wraps a Graphics so every filled shape gets a thick dark outline and one shade tone.
- `src/systems/atmosphere.ts`: lit windows, neon signs, wet-street reflections, the golden wash over coloured zones and night rain, drawn above the gray layer (noir levels only).
- `docs/art.md`: the art style guide (palettes, outlines, proportions, crowd tone, painted backdrops).
- `src/data/items.json`: the 22 shop items (5 hats, 6 outfits, 5 signs, 6 hair colours). `src/data/items.ts` describes and checks them.
- `src/systems/save.ts`: coin balance, owned and equipped items, mirrored to localStorage.
- `src/systems/economy.ts`: par time and finish bonus.
- `src/systems/sfx.ts`: coin pickup sound, synthesised with Web Audio.
- `src/ui/widgets.ts`: shared button, coin drawing and coin-count label.
- `src/entities/PoliceOfficer.ts`: patrol movement, facing, vision test (with the shared night sight rule), cone or flashlight drawing, and every walk to a target on the navigation grid: the noise alert (go, look around, walk back), the chase and the search, with a "!" (chasing) or "?" (noise or searching) above the officer.
- `src/systems/nav.ts`: the navigation grid built from a level's obstacles: A* over 20-unit cells with an officer margin, then smoothed into long straight legs.
- `src/systems/VirtualJoystick.ts`: floating touch joystick. Ignores touches that land on the trumpet button.
- `src/systems/geometry.ts`: ray-vs-rectangle, line of sight, angle helpers.
- `src/systems/night.ts`: the night darkness overlay (dark screen with holes for Pip, lamps and flashlight beams).
- `src/entities/StandSpots.ts`: stand-still spots: posters and tags, their progress rings and wall marks.
- `src/systems/noir.ts`: the gray, high-contrast look for controlled ground: the filtered world layer, colour zones, the colour mask and `noirMatrix` (also used by dialogue backdrops).
- `src/levels/dev/*.json`: practice levels (`practice-chase.json`); they come after the real levels in the index. They ship in every build unless the build setting `VITE_PRACTICE_LEVEL=off` is set (for example `VITE_PRACTICE_LEVEL=off npm run build` for an app store build): the level data then leaves the bundle and the menu has no Practice button.
- `src/levels/*.json`: level data. `src/levels/types.ts` describes the format; `src/levels/index.ts` loads and checks it; `src/levels/resolve.ts` applies story flags (conditional entries, modifiers).
- `src/story/chapters.json`: the eight chapters in play order (id, title, level, intro, outro).
- `src/story/cast.json`: speakers for dialogue (name, name colour, what they wear on stage).
- `src/story/dialogue/*.json`: dialogue scenes; the file name is the scene id.
- `public/backdrops/*.webp`: painted dialogue backdrops, 1080 by 960 WebP under 300 KB each (street, harbor, cellar, night-street in use; velvet-heights and city-hall kept for chapters 7 and 8). `src/story/backdrops.ts` maps a stage to its file and warms the browser cache at launch. See the folder's README.
- `src/story/story.ts`: loads and checks chapters, cast and dialogue; chapter state (done / open / locked) and `startChapter`.
- `src/story/flags.ts`: story flag and condition types, `matches`.
- `tools/`: balance tools. Node scripts that start Vite, load a level in headless Chromium and measure difficulty: crowd rides (with coins earned), blind solo runs, standing groups, good standing spots, a perfect-knowledge route search, a cone coverage map, coin risk, trumpet crossings and noise alerts (`trumpet.mjs`), poster and tag runs at night (`posters.mjs`), and chase and search escapes (`chase.mjs`). Darkness is part of the officers' sight test, so every tool measures night levels correctly. `tools/README.md` explains each and how to read the output. Run them after any level change.

## Design decisions

- Portrait, fixed 540x960 design resolution. The canvas scales to fit the screen with letterboxing. All level coordinates use these units.
- A level is as wide as the screen (540) and several screens tall (level 1: 2880, three screens). The camera follows the player vertically within the level bounds.
- Controls: the same keys in every chapter. Arrow keys or WASD on desktop; hold Shift to walk at crowd pace (60 percent); hold X to sprint out of crowd pace assist; hold Space to play the trumpet (in levels without the trumpet, such as chapter 1, Space does nothing during a run); on touch screens a round trumpet button sits bottom right, opposite the joystick, and plays while held. On touch screens a joystick appears where the finger lands and follows the drag. Mouse dragging works too. Keyboard input wins when both are used.
- Difficulty: `DIFFICULTIES` in `config.ts` holds one object per difficulty with `catchTimeMs`, `visionRangeFactor` (multiplies every officer's `visionRange`), the trumpet settings `hearingRadius`, `noiseRisePerSec`, `noiseFallPerSec`, `lingerMs` and `alertRadius`, and the night settings `darkRangeFactor`, `darkness`, `pipLightRadius`, `nightHearingFactor` and `nightAlertFactor`. Night: Normal 0.5 of the range in the dark, darkness 0.78, light radius 120 around Pip, hearing and alert radius times 1.3; Relaxed 0.45, 0.62, 150, hearing times 1.3, alert times 1.2. Relaxed (internal key `easy`, kept so saves still load; players never see "Easy"): 1500 ms, cones 80 percent as long; hearing 230, meter full after 7 s of playing and empty after 4 s of silence, linger 5.5 s, alert radius 380. Normal: 500 ms, full cones (the original balance); hearing 190, full after 4.5 s, empty after 7 s, linger 4 s, alert radius 520. New saves start on Normal (`DEFAULT_DIFFICULTY`). A save that already has a difficulty keeps it, and a save made before difficulties existed loads as Relaxed (`LEGACY_DIFFICULTY`), which is what those players had. The choice is saved and shown under the level name in the HUD. Coin values and the finish bonus are the same in both.
- Crowd pace assist (both difficulties): inside a marching group, with input within `ASSIST_ANGLE_DEG` (60) of the group's heading, speed is capped near the group's pace so the player stays hidden. The cap is pace times (1 - distance ahead of the group centre / 150), kept between 0.85 and 1.08, so a held push settles toward the middle instead of drifting out the front. In a standing group the cap is 95 percent of `HIDE_SPEED_FLOOR` (23.75 units/s). A joystick pushed to 95 percent or more of its radius, or holding X, skips the cap. While the cap is holding the player back, a hint at the bottom says how to break cover.
- Buildings and parked cars are axis-aligned rectangles. They block movement and line of sight. The player collides as a square of half-size `PLAYER_RADIUS` (13 times `CHARACTER_SCALE`, so 16.25), resolved one axis at a time so it slides along walls.
- Detection: an officer sees the player when the player's centre is within `visionRange`, within half of `visionAngle` of the officer's facing, and the segment between them crosses no obstacle. A suspicion meter fills while any officer sees the player and drains at twice that speed otherwise. While the player is hidden in a crowd it fills at `HIDDEN_DETECTION_RATE` (25 percent). At the difficulty's `catchTimeMs` (Normal 500 ms, Relaxed 1500 ms) the player is caught. A red bar above the player shows the meter.
- Vision cones are drawn by casting `VISION_RAYS` rays per officer each frame, so the drawn cone is cut off by obstacles. What the player sees matches what the officer can see.
- Officers walk their waypoints at `speed`, wait `pauseMs` at each one, and turn smoothly toward the next leg (also while waiting). `loop` routes return to the first point; `pingpong` routes walk back.
- Levels are data. Every `src/levels/*.json` file is picked up by `import.meta.glob`. Players reach a level through the chapter that names it in `chapters.json`. The balance tools still start levels by file-name index. Bad data fails at startup with an error naming the file.
- Story flow: Play → chapter map → chapter intro (if any) → level → on finishing, the chapter is saved as done, then the outro plays over the paused level, then the result screen. Getting caught shows the result screen with no outro. Chapter 1 is always open; each later chapter opens when the one before it is done. Finished chapters replay with full coin payout and play their intro and outro again (Skip ends them). A chapter with no `level` shows "Coming soon" once open.
- Dialogue stage: the scene's `stage` picks the backdrop (`street`, `night`, `harbor` or `cellar`). Each has a painted image in `public/backdrops/` (`night` uses `night-street.webp`), loaded by `DialogueScene.preload` (and fetched in the background at launch, so scenes open in 60 to 290 ms locally); the image fills the 540 by 480 strip with a gradient darkening its foot (`SHADE_MAX` 0.5 from y 200 down) so the characters stay readable. When an image is missing or fails to load the flat silhouette backdrop drawn in code is used (the street one has a Drone and Partners billboard). The tone filter grays either kind: a drawn backdrop gets the full filter, a painted one only `PAINTED_GRAY_STRENGTH` (0.6, one setting in `config.ts`) of it, so its neon and golden light survive. The scene's `tone` grays the backdrop with `noirMatrix` or leaves it in colour; a line's `tone` fades it over 0.5 s. Characters always stay in colour. Characters stand with their feet on y 452, drawn in front view at 2.7 times base size. Pip always wears the player's equipped items and stands leftmost. The speaker steps 16 units forward and grows 7 percent at full brightness; everyone else dims to 42 percent brightness with a ColorMatrix filter (alpha on the canvas renderer). Narration, and speakers who are not on stage (the Mayor on a loudspeaker), dim everyone. A line's `enter` and `exit` walk characters on and off from the nearer screen edge in 450 ms.
- Dialogue box: sits under the stage from y 496 and keeps one height per scene, sized to the scene's longest line (measured when the scene opens), so it never changes height between lines. Text is 26px and wraps across the full box width (about 34 characters per row). The box ends 16 units above the bottom edge at most; in dev a scene whose longest line needs more logs a console warning. Choices stack under the box. Tap or Space/Enter advances; Skip or Escape jumps to the next choice ahead, or ends the scene when none is left, so choices cannot be skipped past. While a choice is showing, Skip and tap-to-advance are off; tap a button or press 1-4. Input is ignored for the first 300 ms so a lifted finger or held key from the level does not skip a line. Replaying a chapter and picking differently overwrites the flag.
- Crowds: defined per level. Marching groups walk their `path` at `speed` (default 60 percent of `PLAYER_SPEED`, 102) in a loose two-wide column that turns with the path, fade out at the end, and a new group starts at the first point `intervalMs` later. Standing groups shuffle in place at `x, y`. Protestors block nothing: not movement, not line of sight. A faint disc shows each group's `radius` (default `CROWD_RADIUS`, 75).
- Hiding: the player is hidden while within a group's radius and moving no faster than `HIDE_SPEED_MARGIN` (1.1) times the group's speed, with a floor of `HIDE_SPEED_FLOOR` (25 units/s) so standing groups (speed 0) allow a slow shuffle. Player speed is measured after collision, so pushing into a wall counts as standing. A three-heads icon shows above the player while hidden.
- Trumpet (levels with `"trumpet": true`): while playing, Pip walks at `TRUMPET_SPEED_FACTOR` (half) speed and a yellow sound ring leaves him every 380 ms, growing to the hearing radius, so the rings show who can hear. The noise meter (top centre of the HUD) rises at `noiseRisePerSec` while playing and falls at `noiseFallPerSec` otherwise. When it fills, every officer within `alertRadius` of Pip who can walk there in a straight line (obstacles grown by 14 units) comes to look, the meter empties and the screen flashes red. Playing itself is never seen; only the meter calls officers.
- Bystanders: idle locals placed per level (`bystanders`), drawn like protestors. They stroll within `wander` (default 25) of their spot at 18 units/s, block nothing and hide no one on their own. While Pip plays, those within `hearingRadius` walk over at `BYSTANDER_FOLLOW_SPEED` (100) and keep a spot on a 44-unit ring around him, also while he walks. When he stops, they stay with him for `lingerMs`, then drift home at 45 units/s; playing again draws them back. Idle wandering uses a seeded random source, so the balance tools repeat exactly.
- Gathered group: at least `GATHER_MIN` (3) drawn bystanders within 70 units of Pip form a group centred on them, shown as a faint disc. It hides Pip with the crowd rules: inside its 75-unit radius and not faster than 1.1 times its pace (100), so detection fills at 25 percent. Because the group walks with Pip, he stays hidden while walking at up to 110, which a strict standing-group rule (25 units/s) would not allow; that is what makes slipping past during the linger time possible. The crowd pace assist caps Pip at 95 inside the group, in any direction; X or a full joystick push breaks out.
- Noise alert: when the noise meter fills, every officer within `alertRadius` of Pip (straight distance) whose walk to him on the navigation grid is at most `NOISE_WALK_FACTOR` (1.6) times that radius walks to the spot at 1.6 times patrol speed, sweeps the cone left and right there for `ALERT_LOOK_MS` (3.5 s), walks back to where they left the route, and resumes the patrol. A "?" shows above them while they walk there and look. Their cone works as normal throughout. Officers behind buildings now come round them; before the navigation grid, only officers with a straight clear line responded.
- Navigation (`NavGrid`): every walk to a target (noise response, the walk back, chase, search) follows a route on a grid generated from the level's obstacles: 20-unit cells, a cell is blocked when it touches an obstacle grown by 14 units (the officer's half-size plus a little), A* over eight-way moves without cutting corners, then the route is pulled straight wherever the grown obstacles leave a clear line. A goal inside a blocked cell moves to the nearest free cell, and an unreachable goal counts as arrived. A walking officer re-plans when the goal moves, at most every 250 ms. Patrol legs stay as authored. The grid is built when a level starts and held in `PoliceOfficer.nav`; `NavGrid` takes an optional margin (the balance tool gives Pip 20, because his body is wider).
- Chase (levels with `"chaseMode": true`; others keep the instant catch): when the seen meter fills, the officers who see Pip start chasing instead of catching him. A chasing officer runs after the shared target (where any chaser last saw Pip) at `chaseSpeedFactor` times Pip's top speed (Normal 1.08, Relaxed 1.06: 184 and 180 against 170, so outrunning them in a straight line fails), shown with a red "!" and a fully red cone, and turns four times faster than on patrol. The officer whose meter filled stands startled for `chaseReactMs` (Normal 600 ms, Relaxed 900 ms) before running; an officer who joins stands for `chaseJoinMs` (Normal 1200, Relaxed 1600) first. Every officer within `chaseAlertRadius` (Normal 300, Relaxed 240) of a chaser, whatever they are doing, joins the chase. Pip is caught only when a chasing officer's centre comes within `PLAYER_RADIUS` + `OFFICER_RADIUS` (16.25 + 12) of his. Chasers keep a player they can see even in a crowd. Only officers that are not chasing or searching fill the meter, and the meter empties when a chase starts.
- Pursuit: when no chasing officer notices Pip, the chasers do not stop. They keep running at chase speed to where he would be had he held his last seen heading and speed (last seen spot plus heading times speed times the time lost, stopping at the first wall), for `chasePursuitMs` (Normal 3 s, Relaxed 2.5 s). Any chaser that notices him again resets the timer. Only then do they search.
- Stamina (levels with `chaseMode` only; others have no bar and no limit): a bar under Pip shows it (green, yellow when low, red while winded). Moving faster than crowd pace (`PLAYER_SPEED` times `WALK_FACTOR`, 102) drains it in proportion to the speed above crowd pace: full speed empties it in `staminaDrainSec` (Normal 4 s, Relaxed 5 s). At crowd pace or slower it recovers over `staminaRecoverSec` (8 s, empty to full), `staminaRestFactor` (2) times faster while hidden in a crowd or in darkness at night. When it hits zero Pip is winded: his top speed is `staminaTiredFactor` (0.6, about crowd pace) of full until stamina is back to `staminaResume` (25 percent). Officers never tire. All five values are per difficulty in `config.ts`.
- Search: after the pursuit the chasers search. `markSeen` stores where a chaser last saw Pip, his heading (last moving frame) and his speed then. The search lays points along that heading: Pip's last seen speed times `searchAheadSec` (Normal 6 s, Relaxed 5 s), at most `searchAheadMax` (900 and 800 units), stopping at the first wall; three points on the line (a third, two thirds and the end), a point `searchSpread` (100 and 90) to each side of its middle and its end, and the last seen spot itself. The officers split the points: officer i starts at point i times (points / officers) and checks the rest in turn, round again, jogging between points at `SEARCH_SPEED_FACTOR` (1.0) times chase speed and looking around for `SEARCH_PAUSE_MS` (0.9 s) at each, for `searchMs` (Normal 12 s, Relaxed 14 s) from reaching the first point. A "?" shows above them (yellow); then they walk back to where they left their route and resume the patrol. With no heading (Pip stood still) the points ring the last seen spot at 50 to 110 units. A searching officer notices a player in the open with the normal cone (and the night rule). A hidden player (in a crowd at its pace, or in a bystander group) or one standing in the dark at night is only noticed within `searchCloseRange` (Normal 55, Relaxed 40), in any direction and with a clear line. A searching officer who notices Pip chases again at once, with the startle delay.
- Practice level (`src/levels/dev/practice-chase.json`, reached from the Practice button on the menu unless `VITE_PRACTICE_LEVEL=off`): a 540 by 1500 grid of city blocks with 90-unit streets, an open plaza in the middle, one marching crowd that snakes through the streets, three officers (the plaza, the east street, the south street) and `chaseMode`. It has no intro, coins or chapter, and its finish ends the run as usual.
- Commuters: bystanders with `"kind": "commuter"`, Drone and Partners office workers in gray suits (`gray-suit`, plain hair or a gray beanie). They need `COMMUTER_HEAR_MS` (1500) of music within hearing before they come over (what they have heard fades at the same rate when it stops) and walk at `COMMUTER_FOLLOW_SPEED` (60). A gathered group moves at its slowest member's pace, so with commuters in it Pip stays hidden only up to 66 units/s and the assist caps him at 57. Built for later chapters; no level uses them yet.
- Noir look (levels with `noir`): controlled ground is drawn gray and high-contrast, music colours it. Every world object except Pip, his suspicion bar and hidden icon, and the HUD sits in one Layer (depth 29, just under Pip). A ParallelFilters filter on the layer draws a gray copy (`noirMatrix`: equal-weight gray, `NOIR_CONTRAST` 0.45 extra contrast around mid-gray, leaning cold blue: channels times 0.86 / 0.97 / 1.14 and a lift of 9 in the blue shadows) with the original colours on top, cut by a mask of everything coloured: zones that start coloured, won zones, a soft glow around Pip while he plays (grows to 75 percent of the hearing radius in 0.5 s, fades over 1.2 s) and a fading disc behind each sound ring. The mask is a Graphics redrawn each frame at half resolution in screen space. A gray zone with `musicMs` turns coloured for the rest of the run once that much trumpet music has been played inside it, filling outward from Pip's spot over 1.4 s; a rainbow bar under the noise meter shows progress while Pip stands in one. Ground outside every zone is gray. Pip and everything he wears are always in colour. Phaser's `contrast()` writes matrix offsets in 0..1 although its ColorMatrix reads them in 0..255, so `noirMatrix` builds the matrix by hand. On the canvas renderer the level stays in colour.
- Lighting and mood (noir levels only, `atmosphere.ts`, drawn above the gray layer so the lights keep their colour): lit windows along the street edge of every building (about two thirds lit, the same ones every launch), neon tubes from the level's `neon` list (a bright core, three halos and a coloured spill on the road), reflections as thin streaks running out from every window and lamp across the wet road, and a halo with vertical streaks under each lamp. The reflections are cold blue (0x8cc4ff) over gray ground and warm gold (0xffc86a) over coloured ground, and are redrawn when a zone changes colour (`Noir.revision`, then once more after the 1.6 s fill). Coloured zones get the golden grade as a warm additive wash (0xff9f2e, 21 percent at the top of a zone fading to 10 percent at the bottom, in ten bands), not a filter pass (a colour-matrix pass on the colour copy cost 1 to 2 fps). Night levels add rain: 70 pale streaks falling at 560 to 840 units/s, slanted, in one Graphics in screen space; at night everything in this layer sits above the darkness (depth 35.2) because it is light. Windows, neon and rain draw at depth 29.4 by day.
- Noir cost: each frame `Noir` picks one of three setups by what the camera sees: the full mask-and-blend chain only when gray and colour share the screen, a single colour-matrix pass when the view is all gray, and no filter when a finished coloured zone covers the view. Measured in headless Chromium with iPhone 13 emulation, which renders WebGL in software (no GPU), so every full-screen pass costs far more than on a phone: before the filter 27 to 31 fps in all four test scenes; after it 20 to 24 fps when the view is all gray (level 2's quay standing still) and 15 to 18 fps when gray and colour mix (level 1's start, level 2 while playing or near a coloured zone). Re-measure on a real phone before adding more full-screen filters.
- Night (levels with `night`): street lamps are lit pools (`lights`: x, y, radius). An officer spots a player standing outside every pool only within `darkRangeFactor` of the cone's range; inside a pool at full range. The rule lives on `PoliceOfficer.sight` (static, set by GameScene per level), so `canSee` applies it everywhere, including officers the tools create. Cones draw as flashlight beams: a faint full-length beam (where a lit player is seen) and a brighter inner part to the dark range (where a player in the dark is seen). `NightOverlay` darkens the screen at `darkness`, leaving soft holes for a `pipLightRadius` circle around Pip, every lamp pool and every beam; it is a half-size DynamicTexture refilled and erased each frame, drawn at depth 35 (over the world and Pip, under the suspicion bar and HUD). Trumpet hearing and alert radii are multiplied by `nightHearingFactor` and `nightAlertFactor`.
- Stand-still spots (`StandSpots`): posters and tags. Progress builds while Pip's centre is within `STAND_RADIUS` (30) and he moves no faster than `STAND_STILL_SPEED` (12); moving or leaving pauses it and keeps it; started spots keep a faint ring. A ring around the spot shows progress and a label says to hold still. Posters take `POSTER_MS` (2500); an unplanted spot is a pale paper outline (a sheet with a torn corner and text lines) on the wall, pulsing slowly (2.8 s breath) and drawn at depth 36, above the night darkness, as an outline only so it lights nothing around it; spots off-screen get a small poster icon with an arrow at the screen edge (the nearest 3 only, spread at least 40 apart, inset 30 from the sides, 124 from the top and 150 from the bottom so they clear the HUD and trumpet button). Planting removes the outline and the icon, draws the planted poster in pink and yellow and colours a `POSTER_ZONE` (180) square around it for the rest of the run (`Noir.colorArea`). The finish is barred and labelled CLOSED until `required` posters are up ("Put up 4 posters first" shows if Pip reaches it early); the HUD shows "Posters n/4", then "n/6" in green. Each poster past `required` adds `bonusCoins` to the run. Tags (`tags`) pay their coins into the run when done and draw graffiti; on finishing a chapter, each tag's `flag` is set to true if it was done this run and false if not, before the outro plays, so a replay can change the choice.
- The player wears a magenta vest (`vest-magenta`, kept out of the crowd pools) and a white marker ring, so they stay visible in a crowd.
- Crowd members are baked: `Character` with `{ baked: true }` renders its layers once into a texture per look (2x resolution) and shows one image. This saves about 20 percent of frame time with 32 protestors. Baked members do not swing their hands.
- Character size: the player and officer containers are drawn at `CHARACTER_SCALE` (1.25). The art stays authored at base size. Collision and the suspicion bar offset scale with it. Vision cones start at the officer's centre, which scaling does not move. Level gaps the player must pass need to be at least 33 units wide (level 1's narrowest is 50).
- Cosmetics: the player is a `Container` with separate Graphics layers, bottom to top: body (hands), outfit, sign, head (uses the body's skin tone so it sits above the outfit), hair, hat. A hat hides the hair under it. The front view has the layers in the order sign, body (trousers, shoes, hands), outfit, hair back (long hair, the back of a bob), head (with a cheerful face: wide eyes with a glint, rosy cheeks, a big smile), hair front, hat, with the feet at (0, 0); its coordinates are described at the top of `cosmetics.ts`. `setBodyStyle`, `setOutfit`, `setSign`, `setHat`, `setHair` and `setHairColor` redraw one layer; `setLook` sets all. A look has `hair` and `hairColor` too; the player's `hair` is `spiky` and his `hairColor` is the equipped hair colour (default `hc-brown`), so spiky tips show round the edge of the beanie from above. Items draw in local space, facing up, head at (0, 0). Signs are held ahead of the player and reach up to y -32, so baked textures cover -32..32. Crowd members never carry signs and never wear shop items, so the player stays unique.
- Comic look: every character layer goes through `inkify` (`ink.ts`), which wraps the fill methods of a Graphics: each filled shape gets an outline (`INK`, a dark violet; 1.25 units top-down, 1.5 front view) and, when it is at least 5 units across, one shade tone (a darker crescent at the lower right, `shadeOf`: 70 percent of the colour, a little cooler). Shapes under about 3 units (stripes, studs, text lines) and see-through ones get no outline, so the drawing recipes stay plain `fillStyle(colour).fillCircle(...)` calls. The head, its hair and the hat are drawn 1.25 times larger top-down (about the middle of the head) and 1.3 times in front view (about the neck, y -46), for big heads and clear silhouettes. Officers are inked too, with a bigger cap. Protestors and commuters come from a fixed seeded pool of 72 looks (`randomProtestorLook`), so a crowd that keeps spawning reuses the same baked textures: bright hair colours, eight hairstyles, 24 outfits (tees, stripes, hoodies, coats), bare-headed half the time so the hair shows. Cast members take `hair` and `hairColor` in `cast.json` like any other part of `look`. The art style guide is `docs/art.md`.
- Frame time is capped at 50 ms per update, so a background tab does not teleport the player or officers.

## Economy

- Coins lie on the street, placed per level. Walking within `COIN_PICKUP_RADIUS` (26.25) of a coin's centre picks it up. A coin is worth its `value`, default `COIN_VALUE` (5). Coins worth more than 5 draw larger, in cyan with a star.
- Coins picked up in a run are held until the run ends. Finishing pays them out plus a speed bonus. Getting caught loses all of them; the Caught screen says how many.
- Speed bonus: `FINISH_BONUS_MAX` (40) at or under the level's par time, falling in a straight line to `FINISH_BONUS_MIN` (10) at `FINISH_SLOW_FACTOR` (3) times par and slower. Par is the level's `parTimeSec`, or by default its height walked at full speed times `PAR_TIME_FACTOR` (1.2): 20.3 s for level 1.
- Level 1 has 15 coins worth 135: 10 commons on the two crowd routes (5 per route), one at each standing group, and 3 valuable coins (25) in the side alleys at y 1350 and 1920 where officers sweep. Measured with `tools/ride.mjs` and `tools/coins.mjs`: riding a crowd collects its 5 route coins and never gets caught (24 of 24); a good run (joining the first group) earns 60 via crowd 0 (27.3 s, bonus 35) or 51 via crowd 1 (38.8 s, bonus 26). A blind solo dash from the nearest route to a valuable coin and back is caught on 28, 18 and 18 of 40 start times. Every valuable coin is at least 138 units from a crowd route, beyond the 75-unit crowd radius.
- Prices: cheapest about two good runs (120), most expensive about ten (600).
- Save data lives in localStorage under `protest-route.save.v2`: `{ "coins": 120, "owned": ["hat-bandana"], "equipped": { "hat": "hat-bandana", "outfit": "vest-magenta", "sign": "none" }, "difficulty": "easy", "completed": ["ch1"], "flags": { "helpedRuby": true }, "showFps": false }`. `completed` holds finished chapter ids; `flags` holds story flags (choices are stored as the flags they set). When v2 is missing, a `protest-route.save.v1` save is loaded, given empty `completed` and `flags`, and written to v2; the v1 key is left in place. A save with a missing or unknown `difficulty` loads as Relaxed (`easy`); a brand-new save starts as Normal. Every read and write is wrapped in try/catch; if storage is blocked the game runs with progress kept in memory for the session. Loading drops unknown items, unowned equipped items and bad numbers. Bump the key's version when the shape changes incompatibly.
- Default items (beanie, magenta vest, no sign) are always owned, never listed in `owned`, and shown first in each locker tab.

## Shop item format

`src/data/items.json` is an array. Each entry:

```json
{ "id": "hat-bandana", "name": "Bandana", "category": "hat", "price": 120, "shape": "bandana", "front": "bandana", "color": "#c0392b", "accent": "#f4f4f4" }
```

- `id`: unique, stored in saves. Renaming one drops it from existing saves.
- `category`: `hat`, `outfit`, `sign` or `haircolor` (the locker tabs; a `haircolor` item is only a colour: `shape` and `front` are `"color"`, `color` is the hair colour, and its id, such as `hc-pink`, is the key in `HAIR_COLORS`).
- `price`: whole coins, above 0.
- `shape`: top-down drawing recipe for that category, used in the game. Hats: `bandana`, `beret`, `hardhat`, `crown`, `flowers`. Outfits: `tracksuit`, `jersey`, `poncho`, `cape`, `studded`, `scarf`. Signs: `placard`, `lollipop`, `flag`, `banner`, `star`. Recipes live in `cosmetics.ts` (`HAT_SHAPES`, `OUTFIT_SHAPES`, `SIGN_SHAPES`) and take the two colours.
- `front`: front-view drawing recipe, used on the dialogue stage and in the locker preview. The names match the `shape` list; recipes live in `FRONT_HAT_SHAPES`, `FRONT_OUTFIT_SHAPES` and `FRONT_SIGN_SHAPES`. Usually the same as `shape`, but any pairing is allowed.
- `color`, `accent`: `#rrggbb`.

Adding an item with existing shapes is a JSON-only change. A new shape needs a top-down recipe and a front-view recipe in `cosmetics.ts`, and its name in `SHAPES` and `FRONT_SHAPES` in `items.ts`. Built-in items (the defaults, crowd clothes, cast clothes) are tables in `cosmetics.ts` where every entry has `draw` (top-down) and `front`. Bad entries fail at startup with an error naming the entry. The locker shows up to eight tiles per tab (four a row, two rows: the default plus seven items); more items per category need a scrolling grid. Hair colour tiles and the hair preview go bare-headed, so the colour shows.

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

Night, posters and tags are optional (chapter 3):

```json
"night": { "lights": [{ "x": 175, "y": 1800, "radius": 110 }] },
"posters": { "required": 4, "bonusCoins": 20, "spots": [{ "x": 142, "y": 2450, "wall": "left" }] },
"tags": [{ "x": 340, "y": 608, "label": "Tag the van", "flag": "vanTagged", "coins": 50, "ms": 3000 }]
```

Poster spots stand in the street next to a wall (`wall` says which side; the mark is drawn 24 units toward it). Put the first spot close to the start in a dark, unwatched corner, so the player can learn the action without risk. A car with `"style": "squad-van"` draws a Quiet Squad van. Check lit and dark spots with `tools/posters.mjs`, which also prints how much of the time each spot is seen.

`bystanders` need `"trumpet": true` (startup fails otherwise) and can carry `"if"` and `"kind": "commuter"`. Give players a quiet spot with bystanders and no officer within the Normal `alertRadius` (520) to try the trumpet. Bystanders walk straight to Pip and slide along obstacles, so place them in open ground. `finishLabel` replaces "FINISH" in the finish zone.

The noir look is optional:

```json
"noir": { "zones": [
  { "x": 0, "y": 1990, "width": 540, "height": 890, "start": "gray", "musicMs": 3000 },
  { "x": 230, "y": 0, "width": 80, "height": 430, "start": "color" }
] }
```

Without `noir` the level is all colour. With it, ground outside every zone is gray. `start` is `gray` or `color`. `musicMs` (gray zones only, trumpet levels only) is the trumpet time inside the zone that turns it coloured for the rest of the run; without it a gray zone stays gray. Zones may overlap; colour wins. Level 1: the busking corner at the start (y 2680 to 2880) is coloured, the rest gray. Level 2: quay, stalls and square are gray zones won after 3, 4 and 6 s of music; the cellar door gap is coloured.

Neon signs are optional (noir levels): `"neon": [{ "x": 112, "y": 275, "width": 6, "height": 48, "color": "#ff3fa4" }]`. Each is a tube's box on a wall edge; it is drawn above the gray with a halo and a spill on the road. Levels 1 to 3 have four each.

Chase and search are optional:

```json
"chaseMode": true
```

With it, a full seen meter starts a chase instead of an instant catch (see Chase and Search above). The values are per difficulty in `config.ts`. Give such a level corners and a crowd or darkness to hide in, and check it with `tools/chase.mjs`. Level files in `src/levels/dev/` are development-only practice levels.

Coins and par time are optional:

```json
"parTimeSec": 20,
"coins": [{ "x": 205, "y": 2450 }, { "x": 60, "y": 1350, "value": 25 }]
```

Put common coins on crowd paths (within 26 units, so riding collects them). Put valuable coins more than 75 units from every crowd path and check them with `tools/coins.mjs`.

Level 1 balance on Normal (measured with the scripts in `tools/`): riding either marching group to the finish survived 24 of 24 runs across 12 cycles, with peak suspicion 124-464 ms of the 500 ms limit. Standing still alone at either standing group's spot gets caught (7.2 s and 0.5 s); standing in the group survives 90 s. Walking the marching routes alone at full speed survived 5 of 23 start times. A search with perfect timing still finds a solo route in about 27 s. Officers that walk the same direction as a crowd, just behind it, are what kill crowd runs: prefer crosswise sweeps with narrow cones (50 degrees) near crowd paths.

Level 1 by difficulty (`--difficulty normal` / `easy`, shown to players as Relaxed):

| Check | Normal | Relaxed |
|---|---|---|
| ride.mjs, precise steering | 24 of 24, worst peak 464 of 500 ms | 24 of 24, worst peak 320 of 1500 ms |
| ride.mjs --assist, three-quarter push | 23 of 24, worst peak 500 ms | 24 of 24, worst peak 308 ms |
| blind.mjs crowd 0 route, full / 60 percent speed | 5 / 1 of 23 | 23 / 19 of 23 |
| blind.mjs crowd 1 route, full / 60 percent speed | 6 / 3 of 23 | 23 / 23 of 23 |
| coins.mjs valuable coins, solo dash caught | 28, 18, 18 of 40 | 5, 4, 2 of 40 |
| coins.mjs route coins, solo dash caught | 0 of 40 each | 0 of 40 each |

On Relaxed, walking the crowd routes alone at full speed always survives. That is the point of Relaxed for playtesting, but it means crowds and valuable coins carry little risk there.

Level 2 ("Harbor Quay", chapter 2): water along the left edge, a quiet quay (y 2880 to 2000) with five bystanders and no officer within alert range, a stretch of fish stalls (y 2000 to 1350) with two sideways patrols and three bystanders, then the guarded square in front of the fish auction (y 1300 to 450): six bystanders along its bottom edge, no crowds, and five officers on sideways sweeps (two on crossing lines at y 1160 and 1090, a loop around the fountain, short sweeps either side of the fountain) plus one across the top at y 560. The finish is the 80-unit door gap in the auction hall. 8 common coins on the main route (40) and 3 valuable ones (25 each) off it: by the stalls at the water's edge, in the square's left side and its bottom-right corner, each a detour that costs trumpet time. Par time 32 s.

Level 2 measured with `tools/trumpet.mjs` (23 start times, from the square's bottom edge at 270,1330 to the finish; left lane past the fountain, then right lane):

| Check | Normal | Relaxed |
|---|---|---|
| alone, full speed, no trumpet (left / right lane) | 6 / 2 of 23 | 22 / 23 of 23 |
| gather, then move in the linger time | 19 / 17 of 23 | 23 / 23 of 23 |
| play nonstop while crossing | 0 / 0 of 23, officers called in 19 / 20 | 23 / 23 of 23, officers called in 23 / 23 |
| hold until full at the quay practice spot (290,2450) | full after 4.5 s, nobody called (0 of 10) | full after 7 s, nobody called |
| hold until full by the stalls (270,1650), square edge (270,1330), in the square (200,900) | officers called and reached the spot in 10 of 10 each, all back on patrol | same, 10 of 10 |
| whole level from the start, gathering (12 start times) | 11 of 12, 33.5 s, 40 coins (alone: 2 of 12) | 12 of 12 (alone: 11 of 12) |
| gather detour to the valuable coin at 105,770 / 440,1240 | 18 / 20 of 23 | 23 / 23 of 23 |

Most gather failures are caught at the y 1090 line, which a player watching the cones can time; the tool walks blind. On Relaxed every way across survives, including playing nonstop while officers come, so the trumpet carries little risk there, as with crowds in level 1. A good run (all 8 common coins, about 34 s against par 32) earns about 79; each valuable coin adds 25.

Level 3 ("Night Street", chapter 3): a town street at night, buildings both sides with alleys, seven officers with flashlights (sideways sweeps and two vertical ones), seven lamps, four night owls outside a late bar mid-street, six poster spots on the walls (a safe teaching spot at y 2620 in view from the start, 230 units from it; three more dark at y 2200, 1500 and 850; two under lamps at 1800 and 1150), the Quiet Squad van under the brightest lamp near the top with its tag spot below it, and the night tram as the finish. Only the start by the cellar is coloured. 8 common coins (40), 20 per bonus poster, 50 for the van. Par time 42 s.

Level 3 measured with `tools/posters.mjs` (23 start times, blind: walks spot to spot without watching the beams):

| Plan (blind walk spot to spot, standing still at each) | Normal | Relaxed |
|---|---|---|
| the four darkest posters (0, 1, 3, 5), then the finish | 18 of 23 | 23 of 23 |
| all six posters | 3 of 23 | 19 of 23 |
| the four darkest and the van | 13 of 23 | 19 of 23 |

Spot report (Normal; share of 60 s some officer can see the spot): posters 0 and 1 dark, 0 percent; poster 3 dark, 2 percent; poster 5 dark, 2 percent; poster 2 under a lamp, 26 percent; poster 4 under a lamp, 16 percent. The two lit posters are what sink the all-six plan, caught standing under the lamps at y 1805 and 1155. The van's tag spot (3 s under the brightest lamp) is caught in 10 of 23 runs on Normal, 4 of 23 on Relaxed. Failures in the dark-four plan are at the top (the van's lamp at y 600 and the sweep at y 300) and, once, the first sideways sweep (y 2309). The first poster, 230 units from the start, is never seen (0 percent of 60 s). Moving it there from y 2450 changed no number by more than 2 of 23. The tool walks blind; a player watching the beams does much better. Darkness at work: in the dark an officer spots Pip at 90 units but not at 150; under a lamp at 190. Coins: 8 common (40), 20 per bonus poster, 50 for the van.

Frame rate before and after the comic style and lighting (emulated iPhone 13, software WebGL, 6 s standing and 6 s walking north, two runs each, averaged): level 1 14.4 to 12.5 fps standing (about 13 percent lower), level 2 19.0 to 16.2 (15 percent), level 3 12.7 to 10.7 standing and 12.7 to 11.3 walking (16 and 11 percent). A colour-matrix pass for the golden grade cost another 1 to 2 fps and was replaced by the additive wash. The remaining cost is the extra drawing (outlined, shaded layers on the player, windows, reflections, rain) and the larger sprites. Earlier figures (before the comic style): level 2's quay 20 to 22 fps; level 3 about 13 fps, of which the night overlay costs under 1 fps and the noir layer most of the rest.
Earlier frame rate note (emulated iPhone 13, software WebGL, so far lower than a real phone): level 2's quay 20 to 22 fps; level 3 about 13 fps, of which the night overlay costs under 1 fps and the noir layer most of the rest (level 3 with the noir filter switched off: 21 to 23 fps). Level 3 shows gray and colour together all the time (the coloured start and each planted poster), which forces the full mask-and-blend filter chain. If it stutters on a phone, the first fix is a single custom shader instead of the parallel mask chain.

Chase and search measured with `tools/chase.mjs` on the practice level (23 start times, Pip spotted at 245,1140 by the nearest officer while the others join by the rules; "got away" means every officer was back on patrol with Pip not caught). Values: Normal chase speed 1.08 times Pip's, startle 600 ms, join delay 1200 ms, pursuit 3 s, search 12 s, project 6 s (max 900), spread 100, stamina 4 s drain and 8 s recover; Relaxed 1.06, 900 ms, 1600 ms, 2.5 s, 14 s, 5 s (max 800), 90, stamina 5 s and 8 s. The players: `run` straight line, `flee` the smart runner (every 300 ms picks the point he reaches well before the nearest pursuer, out of their sight, not past an officer who is not after him yet), `hide` (sprints and flees the same way until the search begins, then goes to where the crowd will be, at full speed while he has stamina and at crowd pace when winded, and rides it), `hold`. Each player runs in its own browser (several players in one go no longer carry state between them; the scene also no longer keeps Pip's last heading across restarts).

| Player | Normal (target) | Normal | Relaxed (target) | Relaxed |
|---|---|---|---|---|
| stands still where spotted | | 0 of 23 | | 0 of 23 |
| smart runner | 2 to 5 | 6 of 23 | 6 to 10 | 13 of 23 |
| breaks sight, then hides in the crowd | 12 to 17 | 5 of 23 | 16 to 22 | 15 of 23 |
| (reference, stamina off) smart runner / hide | | 9 / 6 | | 19 / 15 |

Targets not reached. Stamina does what it should (Pip runs out after 4 s, the chaser keeps 184 units/s) and lowers the smart runner by 3 on Normal and 6 on Relaxed, but it does not move hiding, and neither number responds to the stamina values: drain 3 to 4 s and recovery 8 to 40 s gave smart runner 6 to 8 and hide 4 to 5 on Normal; Relaxed recovery 8 to 16 s gave 13 to 16 and 15. Both players break sight inside the chasers' head start, so they are not caught either way, and a runner who has got out of sight is not found by the search however tired he is. Hiding is held down by the practice level: the crowd's route runs along the patrol lines of officers 0 and 2, so a hidden Pip rides through their cones. With the three officers moved to cross-wise patrols off the crowd's route (not kept), Normal gave smart runner 20 and hide 16, Relaxed 23 and 18: hiding reaches its range there, but the runner escapes even with stamina. To get both targets the level needs officers who stay in contact with a runner but not with the crowd lane. Closest values: Normal smart runner 6 (target 2 to 5), hide 5 (12 to 17); Relaxed smart runner 13 (6 to 10), hide 15 (16 to 22). A hidden Pip was only ever noticed at close range (searchers noticed him at 40 to 54 units; range 55 and 40). Phone test (emulated iPhone 13, Normal): spotted and sprinting, the bar fell by about a quarter each second, Pip was winded after about 4 s and slowed to 102 units/s while the chaser held 184 and caught him; with stamina at 0.3, recovery was 0.125 per second walking in the open and 0.249 per second hidden in the crowd; chapter 2 has no bar, no stamina change and full speed.

Chapter 2's numbers after the navigation grid replaced the straight-line noise response (`tools/trumpet.mjs`, 23 start times): unchanged, except that playing nonstop on Normal's left lane called officers in 20 of 23 runs instead of 19 (survival 0 of 23 either way). The meter, hold tests, gather runs and alone runs are identical on both difficulties.

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

Flags in use: `vanTagged` (chapter 3's tag spot; true when the van was tagged on the last finished run, false when not; chapter 4 should raise police alertness with it through `modifiers`). It was first named `van_tagged`; `RENAMED_FLAGS` in `save.ts` renames it when a save loads (an old save with `van_tagged: true` becomes `vanTagged: true`, and the migrated save is written back; a save with both keeps the new one's value). Planned in `docs/story.md`: `helpedRuby` (ch4), `gaveNames` (ch6).

## Testing

- Manual: walk into a cone (caught after about half a second), stand behind a building inside a cone's range (not caught), reach the finish (time shown).
- Difficulty and assist: with cleared storage the menu shows Normal selected. A save with `"difficulty": "easy"`, or with no difficulty at all, shows Relaxed and keeps its 1.5 s catch time. A catch takes about 1.5 s on Relaxed and 0.5 s on Normal. On desktop, holding X inside a marching group (chapter 1) or a gathered group (chapter 2) breaks out to full speed; Space plays the trumpet in chapter 2 and does nothing in chapter 1. A three-quarter joystick push inside a marching group stays hidden at the group's pace; a full push breaks out.
- Economy: with cleared storage, collect coins and get caught (Caught screen states the loss, menu balance stays 0); finish a run (balance equals coins plus the stated bonus); buy and equip an item in the locker, start a run (the player wears it); reload (balance, owned and equipped survive).
- Story: with a v1 save holding coins and an item, reload: coins and item survive and a v2 key appears. The chapter map shows chapter 1 open and 2 to 8 locked. Playing chapter 1 shows the intro; Skip starts the level; finishing plays the outro, then the result; chapter 1 shows Replay and chapter 2 Play. Replaying still pays coins. A dialogue with a choice stops Skip at the choice, saves the flag, and the flag survives a reload. In an emulated phone (Playwright `devices['iPhone 13']`), with a hat, outfit and sign equipped, read every line: Pip wears all three on the stage, the speaker is the only one at full brightness (none on narration), the box height never changes within a scene, speaker names end with a colon, narration is italic with no name, text stays above "Tap to continue", and the Stranger walks on in the outro. In the locker, every item previews in front view.
- Trumpet (chapter 2, emulated phone): hold the trumpet button in the quiet stretch; bystanders walk over, rings spread and the meter rises. Release; they stay around Pip for the linger time, then walk home. Hold next to the fish stalls until the meter fills; nearby officers show "?", walk to the spot, look around and return to their patrol. Gather at the square's bottom edge and cross with the group. Finishing plays the outro in the cellar and the chapter map shows chapter 3 as "Coming soon".
- Noir (chapter 2, emulated phone): the quay starts gray; while Pip plays, colour spreads around him (a coin next to him turns yellow, a crate further away stays gray); after 3 s of music the quay stays coloured when he stops; the stalls are still gray; Pip's equipped hat, outfit and sign stay in colour everywhere. Dialogue: chapter 1's intro is in colour until the Squad arrives and gray after, its outro is gray until the last line; chapter 2's harbor is gray and the cellar in colour; the street billboard reads "DRONE & PARTNERS / Focus pays."; Officer Mute mentions Drone and Partners in chapter 2.
- Night and posters (chapter 3, emulated phone): with an officer facing Pip and the others moved away, standing in the dark 150 away is not seen and 90 away is; standing under a lamp 190 away is seen. A poster stood at halfway keeps its progress while Pip steps away and finishes when he returns; its wall turns coloured. With three posters the finish says "Put up 4 posters first" and does not end the run; the fourth opens it. The first spot is visible from the start as a glowing paper outline and can be planted with nothing watching; edge icons point to spots off-screen and the icon goes once its spot is planted. Tagging the van adds 50 to the run; finishing saves `vanTagged: true` and the outro mentions the paint; a replay without tagging saves `false` and the outro line changes.
- Chase and search (emulated phone): tap Practice on the menu. Stand in front of an officer: the meter fills, a red "!" appears above him, officers within the alert radius join, and you are only caught when a chaser touches you (the Caught screen comes when one is within 28 units). Run straight north across the plaza: you are caught. Break sight round a corner and join the crowd: officers show "?" and go to the last seen spot, pass without noticing you (they notice a hidden player only within 55 on Normal), and return to patrol. Chapters 1 to 3 keep the instant catch: standing in a cone catches after 0.5 s on Normal with nobody chasing.
- Comic look and lighting (chapters 1 to 3, emulated phone): characters have dark outlines, hair and big heads in the game, on the stage and in the locker; crowds differ from one another (hair, outfit, hat or none) and look cheerful; gray streets lean cold blue with lit windows, neon and reflections in colour; the coloured start zone is golden; chapter 3 has rain and its neon and windows shine above the darkness; painted backdrops in gray scenes keep colour in their lights and windows. In the locker the Hair tab sells six colours (the preview goes bare-headed) and the other tabs sell the studded jacket, checkered scarf, flower crown and star sign; each shows in front view and, from above, in a run. Chapter 2 and the practice level are unchanged in behaviour.
- Backdrops by place: ch1 intro `street` (the busking corner), ch1 outro `harbor` (the harbor steps), ch2 intro `harbor` (the quay), ch2 outro and ch3 intro `cellar` (the Brass Cellar), ch3 outro `night` (the tram stop). Check a new scene's `stage` against where `docs/story.md` says it happens. In the locker, tap every tile: it is selected and its character matches the preview.
- Show FPS and flag migration: on the menu switch Show FPS on; a level shows "NN fps" bottom left; switch it off and it is gone; the setting survives a reload. A save with `flags: { van_tagged: true }` loads with `vanTagged: true` (and no `van_tagged`), the key is rewritten, and chapter 3's outro still shows the painted-van lines.
- Balance: `node tools/ride.mjs src/levels/level-01.json` and the other scripts in `tools/` (see `tools/README.md`). Playwright 1.63.0 is a devDependency; on a new machine run `npx playwright install chromium` once.
- Other automated checks are ad hoc Playwright scripts against the dev server (`http://localhost:5173/Mobile-game/`), using `window.game.scene.getScene('game')` to place the player and freeze an officer. There is no test runner in the project yet.

## Not built yet

Chapters 4 to 8 (levels, mechanics, dialogue), sound beyond the coin pickup, final character art (front views are placeholder shapes), skin tone choice, saving best times, a chapter that uses the chase and search system (chapter 4 will; so far only the development practice level does), a pause or quit button during a run.
