# Dialogue backdrops

This folder holds the painted backdrops for the dialogue scenes. Each file is one stage.

Files:

- street.png
- harbor.png
- cellar.png
- night-street.png
- velvet-heights.png (added later)
- city-hall.png (added later)

Vite serves everything in `public/` as is, so a file here is reachable at `/Mobile-game/backdrops/<name>.png`. The game does not load these files yet; the stages are still drawn in code (`drawStage` in `src/scenes/DialogueScene.ts`).
