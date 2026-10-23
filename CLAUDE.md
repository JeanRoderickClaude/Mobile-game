# Protest Route (working title)

A top-down cartoon browser game. The player is a protestor who walks a route from a start point to a finish line without being caught by police. Runs in portrait on desktop and in phone browsers.

Live build: https://jeanroderickclaude.github.io/Mobile-game/ (redeployed on every push to `main`).

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
- `src/main.ts`: Phaser game config (540x960 design size, `Scale.FIT`, centred, 2 touch pointers). Exposes `window.game` in dev only.
- `src/config.ts`: tuning constants (speeds, catch time, character scale, colours).
- `src/scenes/GameScene.ts`: loads a level, draws street and obstacles, player input and collision, detection, HUD timer.
- `src/scenes/ResultScene.ts`: "Caught" / "Route complete" overlay with Restart (and "Next level" when one exists). Enter, Space or R also restart.
- `src/entities/Player.ts`: the protestor, built from stacked layers.
- `src/entities/cosmetics.ts`: tables of bodies (skin tones), outfits and hats.
- `src/entities/PoliceOfficer.ts`: patrol movement, facing, vision test, cone drawing.
- `src/systems/VirtualJoystick.ts`: floating touch joystick.
- `src/systems/geometry.ts`: ray-vs-rectangle, line of sight, angle helpers.
- `src/levels/*.json`: level data. `src/levels/types.ts` describes the format; `src/levels/index.ts` loads and checks it.

## Design decisions

- Portrait, fixed 540x960 design resolution. The canvas scales to fit the screen with letterboxing. All level coordinates use these units.
- A level is as wide as the screen (540) and several screens tall (level 1: 2880, three screens). The camera follows the player vertically within the level bounds.
- Controls: arrow keys or WASD on desktop. On touch screens a joystick appears where the finger lands and follows the drag. Mouse dragging works too. Keyboard input wins when both are used.
- Buildings and parked cars are axis-aligned rectangles. They block movement and line of sight. The player collides as a square of half-size `PLAYER_RADIUS` (13 times `CHARACTER_SCALE`, so 16.25), resolved one axis at a time so it slides along walls.
- Detection: an officer sees the player when the player's centre is within `visionRange`, within half of `visionAngle` of the officer's facing, and the segment between them crosses no obstacle. A suspicion meter fills while any officer sees the player and drains at twice that speed otherwise. At `CATCH_TIME_MS` (500 ms) the player is caught. A red bar above the player shows the meter.
- Vision cones are drawn by casting `VISION_RAYS` rays per officer each frame, so the drawn cone is cut off by obstacles. What the player sees matches what the officer can see.
- Officers walk their waypoints at `speed`, wait `pauseMs` at each one, and turn smoothly toward the next leg (also while waiting). `loop` routes return to the first point; `pingpong` routes walk back.
- Levels are data. Every `src/levels/*.json` file is picked up by `import.meta.glob` and played in file-name order. Adding a level needs no code change; a "Next level" button appears after finishing when a next file exists. Bad data fails at startup with an error naming the file.
- Character size: the player and officer containers are drawn at `CHARACTER_SCALE` (1.25). The art stays authored at base size. Collision and the suspicion bar offset scale with it. Vision cones start at the officer's centre, which scaling does not move. Level gaps the player must pass need to be at least 33 units wide (level 1's narrowest is 50).
- Cosmetics: the player is a `Container` with separate Graphics layers: body (hands), outfit, head (uses the body's skin tone so it sits above the outfit), hat. `setBodyStyle`, `setOutfit` and `setHat` redraw one layer. New items are new entries in `cosmetics.ts`. Items draw in local space, facing up, head at (0, 0).
- Frame time is capped at 50 ms per update, so a background tab does not teleport the player or officers.

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

## Testing

- Manual: walk into a cone (caught after about half a second), stand behind a building inside a cone's range (not caught), reach the finish (time shown).
- Automated checks so far are ad hoc Playwright scripts against the dev server (`http://localhost:5173/Mobile-game/`), using `window.game.scene.getScene('game')` to place the player and freeze an officer. There is no test runner in the project yet.

## Not built yet

Sound, menus, more levels, cosmetic selection screen, saving best times, police chasing or alert states beyond the catch meter.
