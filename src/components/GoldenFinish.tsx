import { GOLD, GOLDEN_FINISH_BOX, GOLDEN_SPARKLES, GOLDEN_SWEEP, GOLDEN_SWEEP_WIDTH } from './goldenFinishArt';

/**
 * The golden finish on a baked loaf whose lessons are mastered: a butter-colored sweep across the crust,
 * plus sparkles on the bigger pictures. Drawn over the baked picture, in the same 200 by 140 box.
 * Decorative: the badge or pill says "mastered" in words.
 */
export function GoldenFinish({ sparkles = true }: { sparkles?: boolean }) {
  return (
    <svg className="golden-finish" aria-hidden="true" viewBox={`0 0 ${GOLDEN_FINISH_BOX.width} ${GOLDEN_FINISH_BOX.height}`} fill="none">
      <path d={GOLDEN_SWEEP} stroke={GOLD} strokeWidth={sparkles ? GOLDEN_SWEEP_WIDTH.withSparkles : GOLDEN_SWEEP_WIDTH.alone} strokeLinecap="round" opacity="0.9" />
      {sparkles && (
        <>
          {GOLDEN_SPARKLES.map((d) => (
            <path key={d} d={d} fill={GOLD} />
          ))}
        </>
      )}
    </svg>
  );
}
