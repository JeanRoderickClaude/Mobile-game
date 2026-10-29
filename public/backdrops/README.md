# Dialogue backdrops

Painted backdrops for the dialogue stage. Each file is WebP, 1080 by 960 (twice the 540 by 480 stage strip), about 180 to 265 KB.

In use:

- street.webp: stage `street`, chapter 1 (an old street at dusk)
- harbor.webp: stage `harbor`, chapter 2 (a quay with boats)
- cellar.webp: stage `cellar`, chapters 2 and 3 (the underground venue)
- night-street.webp: stage `night`, chapter 3 (a rainy night street with a tram)

Kept for later, no stage yet:

- velvet-heights.webp: chapter 7 (Drone and Partners' glass towers)
- city-hall.webp: chapter 8 (the square in front of city hall)

Vite serves `public/` as is, so `cellar.webp` is reachable at `/Mobile-game/backdrops/cellar.webp`. The mapping from stage to file is `BACKDROP_FILES` in `src/story/backdrops.ts`. A stage whose file is missing or fails to load falls back to the backdrop drawn in code (`drawStage` in `src/scenes/DialogueScene.ts`). To replace one, convert to WebP at 1080 by 960, keep it under 300 KB, and keep the same file name.
