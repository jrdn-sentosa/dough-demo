/**
 * The golden finish artwork, in the loaf pictures' 200 by 140 box. Shared by the `GoldenFinish` component
 * and the share picture (drawn on a canvas with `Path2D`), so the two can't drift apart.
 */
export const GOLD = '#F6C453';
export const GOLDEN_FINISH_BOX = { width: 200, height: 140 } as const;
/** The butter-colored sweep across the crust. */
export const GOLDEN_SWEEP = 'M40 98 C52 78 74 70 100 70 C126 70 148 78 160 98';
export const GOLDEN_SWEEP_WIDTH = { withSparkles: 5, alone: 7 } as const;
export const GOLDEN_SPARKLES = [
  'M44 66 L46 72 L52 74 L46 76 L44 82 L42 76 L36 74 L42 72 Z',
  'M158 60 L160 65 L165 67 L160 69 L158 74 L156 69 L151 67 L156 65 Z',
] as const;
