import type { StageName } from './story';

/**
 * Painted backdrops for the dialogue stage: public/backdrops/<file>.webp, 1080 by 960 (twice the 540 by 480
 * stage strip). A stage without an image, or whose image fails to load, is drawn in code instead.
 * velvet-heights and city-hall are in the folder for chapters 7 and 8 and have no stage yet.
 */
export const BACKDROP_FILES: Record<StageName, string> = {
  street: 'street',
  night: 'night-street',
  harbor: 'harbor',
  cellar: 'cellar',
};

export const backdropKey = (stage: StageName): string => `backdrop-${stage}`;
export const backdropUrl = (stage: StageName): string => `${import.meta.env.BASE_URL}backdrops/${BACKDROP_FILES[stage]}.webp`;

/** Starts fetching every backdrop in the background at launch, so a dialogue scene finds them in the browser cache. */
export function warmBackdrops(): void {
  for (const stage of Object.keys(BACKDROP_FILES) as StageName[]) {
    const img = new Image();
    img.src = backdropUrl(stage);
  }
}
