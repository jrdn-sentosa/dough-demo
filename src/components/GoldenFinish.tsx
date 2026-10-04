/**
 * The golden finish on a baked loaf whose lessons are mastered: a butter-colored sweep across the crust,
 * plus sparkles on the bigger pictures. Drawn over the baked picture, in the same 200 by 140 box.
 * Decorative: the badge or pill says "mastered" in words.
 */
export function GoldenFinish({ sparkles = true }: { sparkles?: boolean }) {
  return (
    <svg className="golden-finish" aria-hidden="true" viewBox="0 0 200 140" fill="none">
      <path d="M40 98 C52 78 74 70 100 70 C126 70 148 78 160 98" stroke="#F6C453" strokeWidth={sparkles ? 5 : 7} strokeLinecap="round" opacity="0.9" />
      {sparkles && (
        <>
          <path d="M44 66 L46 72 L52 74 L46 76 L44 82 L42 76 L36 74 L42 72 Z" fill="#F6C453" />
          <path d="M158 60 L160 65 L165 67 L160 69 L158 74 L156 69 L151 67 L156 65 Z" fill="#F6C453" />
        </>
      )}
    </svg>
  );
}
