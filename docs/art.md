# Art style guide

Protest Route is a bold comic with two kinds of light: cold noir in the places Drone and Partners controls, and warm golden-hour light in the places the music has won back. Everything is drawn in code (Phaser Graphics and shapes); the painted dialogue backdrops are the only images. The values below are the ones in the code.

## Two zones, two palettes

Gray zones (controlled ground):
- The world is gray with extra contrast (`NOIR_CONTRAST` 0.45) and leans cold blue: red times 0.86, green 0.97, blue 1.14, blue shadows lifted by 9 (`noirMatrix` in `src/systems/noir.ts`).
- Cold light on the wet street: reflections 0x8cc4ff.
- Lamps: warm pools (0xffe8a0) in the world, a cold halo and vertical streaks over them.
- Lit windows 0xffd88a, about two in three along each building edge. Windows and neon stay in colour: they are the only colour a gray street has, apart from Pip.
- Neon signs: magenta 0xff3fa4, cyan 0x29e0ff, amber 0xffb03a, violet 0x9a6bff. A white core, a coloured tube, three halos (7, 12 and 20 percent) and a spill on the road. Soft, never harsh.
- Night adds rain: pale streaks 0xbcd6ff at 40 percent, slanted, always light.

Coloured zones (won back):
- Full colour with a golden wash: 0xff9f2e added at 21 percent at the top of the zone fading to 10 percent at the bottom, like a low sun ahead.
- Warm reflections 0xffc86a.
- Music colours a zone from where Pip stands, outward over 1.4 s; the reflections follow once it settles.

Keep the two apart. Never use gray in a won zone or warm light in a controlled one, except for lit windows and neon, which are light sources.

## Outlines and shading

- Every character shape has a dark violet outline (0x1b1424, warmer than black): 1.25 units top-down, 1.5 in front view (about 4 pixels on the dialogue stage).
- Flat colours with one shade tone: a darker crescent at the lower right, 70 percent of the colour and a little cooler. No gradients, no highlights.
- Small details (stripes, studs, text lines, eyes) have no outline, so they stay crisp.
- The recipes in `cosmetics.ts` stay plain fills; `inkify` in `ink.ts` adds the outline and shade.

## Proportions

- Big heads: the head, hair and hat are drawn 1.25 times larger top-down and 1.3 times in front view. The chin stays put; the head grows up and out.
- Front view: feet at y 0, torso y -44 to -18, head radius 9 (11.7 after scaling) centred at about y -55. Short legs, wide shoulders, round hands.
- Top-down: head radius 8 (10 after scaling), shoulders 30 wide, hands at 15 to each side.
- Silhouettes must read from above at about 35 pixels: hats and hair break the circle (spikes, a mohawk, a bun, a ponytail), signs reach out ahead.
- Hair goes between the head and the hat. A hat hides the hair under it, so a beanie leaves only spikes and locks showing.
- Hairstyles: buzz, spiky, mohawk, bob, long, curly, ponytail, bun. Hair colours are bright: pink, teal, lime, violet, orange, blue, red, blonde, ginger, plus black, brown and white.

## The crowd is cheerful

Protestors are a party, not a mob: bright hair, mixed outfits (tees, stripes, hoodies, coats in pink, yellow, lime, purple, coral, sky and the classics), half of them bare-headed, no two next to each other alike. Faces smile: wide eyes with a glint, rosy cheeks, a big smile. Nobody frowns, shouts or clenches; the police are the stiff ones (dark, plain, one big cap).

The player stays findable: a magenta vest, a white ring, and the hair colour he chose.

## Painted backdrops (dialogue)

- Side-on and painterly, a wide street or room seen from eye level with the floor in the lower third, so characters (feet on y 452 of a 480-pixel strip) stand on it.
- Won-back places in warm golden hour light: the harbor and the street at dusk, the cellar's amber lamps.
- Drone's city in neon noir: rain, wet pavement, glass towers, neon in magenta and cyan.
- 1080 by 960 WebP under 300 KB (see `public/backdrops/README.md`).
- In a gray scene the filter is applied at 60 percent (`PAINTED_GRAY_STRENGTH` in `src/config.ts`), so the neon and golden light survive; the drawn fallback backdrops get the full filter.
- The foot of every backdrop is darkened by a gradient (50 percent at the bottom, from y 200) so characters stay readable against bright floors.
- Chapters 1 to 3 use street, harbor, cellar and night-street. velvet-heights (chapter 7, Drone's towers) and city-hall (chapter 8, the march's end) wait for their stages.

## Checklist for new art

1. Outline and one shade tone, flat colours, no gradients.
2. Reads at 35 pixels from above and in front view on the stage.
3. Bright and friendly if it is a protestor; plain and stiff if it is police.
4. Gray zone: cold. Coloured zone: golden. Lights keep their colour in both.
