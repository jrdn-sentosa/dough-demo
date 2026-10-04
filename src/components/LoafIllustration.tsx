import { useEffect, useState } from 'react';
import type { BreadId } from '../domain/breads';
import type { Stage } from '../domain/types';
import { GoldenFinish } from './GoldenFinish';
import { loafArtUrl } from './loafArt';

/** A little longer than the animation (--stage-ms, 350ms), then the old picture is removed. */
export const CROSSFADE_CLEANUP_MS = 400;

interface View {
  current: Stage;
  /** The stage being faded out. Cleared once the animation is done. */
  previous: Stage | null;
}

/**
 * The loaf at its current stage. When the stage changes, the new picture scales and fades in
 * over the old one (under 400ms, see `--stage-ms`); reduced motion turns the animation off in global.css.
 * The pictures are decorative: Home spells out the stage in text.
 */
export function LoafIllustration({ bread, stage, mastered = false }: { bread: BreadId; stage: Stage; mastered?: boolean }) {
  const [view, setView] = useState<View>({ current: stage, previous: null });
  useEffect(() => {
    if (view.previous === null) return;
    const timer = setTimeout(() => setView((v) => ({ ...v, previous: null })), CROSSFADE_CLEANUP_MS);
    return () => clearTimeout(timer);
  }, [view.previous]);
  let shown = view;
  if (view.current !== stage) {
    // Adjusting state while rendering, so the old picture never flashes before the new one.
    shown = { current: stage, previous: view.current };
    setView(shown);
  }
  return (
    <div className="loaf-art" data-stage={stage}>
      {shown.previous && (
        <img
          key={`out-${shown.previous}`}
          className="loaf-art__img loaf-art__img--out"
          src={loafArtUrl(bread, shown.previous)}
          alt=""
          aria-hidden="true"
        />
      )}
      <img
        key={shown.current}
        className={`loaf-art__img${shown.previous ? ' loaf-art__img--in' : ''}`}
        src={loafArtUrl(bread, shown.current)}
        alt=""
        aria-hidden="true"
      />
      {mastered && shown.current === 'baked' && <GoldenFinish />}
    </div>
  );
}
