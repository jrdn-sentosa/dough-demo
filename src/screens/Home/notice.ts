import { fillTemplate } from '../../content/template';
import type { HomeContent, Tip } from '../../content/types';
import type { StageChange } from '../../domain/tips';

export interface StageNotice {
  text: string;
  /** Index of the newly unlocked tip to point to, or null. */
  tipIndex: number | null;
}

/**
 * What Home says after a deposit or withdrawal moved the loaf to a new stage:
 * the new stage, and the newly unlocked tip if there is one. Null when the stage didn't change.
 */
export function stageNotice(change: StageChange, copy: HomeContent, tips: readonly Tip[]): StageNotice | null {
  if (change.direction === null) return null;
  const stage = copy.stageLine[change.stage].toLowerCase();
  if (change.direction === 'down') return { text: fillTemplate(copy.stageDown, { stage }), tipIndex: null };
  const tipIndex = change.newTips.length > 0 ? change.newTips[change.newTips.length - 1] : null;
  return tipIndex === null
    ? { text: fillTemplate(copy.stageUp, { stage }), tipIndex: null }
    : { text: fillTemplate(copy.stageUpTip, { stage, tip: tips[tipIndex].title }), tipIndex };
}
