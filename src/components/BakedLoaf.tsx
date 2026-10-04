import type { LoafId } from '../domain/types';
import { GoldenFinish } from './GoldenFinish';
import { loafArtUrl } from './loafArt';

interface BakedLoafProps {
  loafId: LoafId;
  /** Lessons mastered: add the golden finish. */
  mastered?: boolean;
  /** Width in px. The picture is 10 by 7. */
  width?: number;
  /** Sparkles go with the golden finish on big pictures, not on the shelf. */
  sparkles?: boolean;
}

/** A baked loaf as a standalone picture, for the celebration and the shelf. */
export function BakedLoaf({ loafId, mastered = false, width = 300, sparkles = true }: BakedLoafProps) {
  return (
    <div className="baked-loaf" data-mastered={mastered} style={{ width, height: (width * 7) / 10 }}>
      <img className="baked-loaf__img" src={loafArtUrl(loafId, 'baked')} alt="" aria-hidden="true" />
      {mastered && <GoldenFinish sparkles={sparkles} />}
    </div>
  );
}
