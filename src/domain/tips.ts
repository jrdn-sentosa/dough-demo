import { STAGES } from './stages';
import type { LoafId, Stage } from './types';

export type TipStatus = 'locked' | 'unlocked' | 'new';

/** What decides whether a tip is open. */
export interface TipContext {
  /** The loaf's current stage (growing mode counts the new part only). */
  stage: Stage;
  /** The fund has been baked at some point. A rebuilding or growing fund keeps every tip it earned. */
  baked: boolean;
}

/** Tips are saved as seen by this id, so opening one clears its "New" badge for good. */
export function tipId(loafId: LoafId, stage: Stage): string {
  return `${loafId}:${stage}`;
}

const rank = (stage: Stage) => STAGES.indexOf(stage);

/** A tip is open once the loaf reaches its stage, or once the fund has baked (a withdrawal never re-locks one). */
export function isTipUnlocked(tipStage: Stage, ctx: TipContext): boolean {
  return ctx.baked || rank(tipStage) <= rank(ctx.stage);
}

/** `new` is unlocked and not opened yet. */
export function tipStatus(tipStage: Stage, ctx: TipContext, seen: boolean): TipStatus {
  if (!isTipUnlocked(tipStage, ctx)) return 'locked';
  return seen ? 'unlocked' : 'new';
}

export interface StageChange {
  /** Which way the loaf moved. Null when the stage is the same. */
  direction: 'up' | 'down' | null;
  /** The stage the loaf is at now. */
  stage: Stage;
  /** Indexes (into the tips list) of tips that this change unlocked, highest stage last. */
  newTips: number[];
}

/**
 * What changed after a deposit or withdrawal, so Home can say so and point to the new tip.
 * `tipStages` are the stages of the loaf's tips, in list order.
 */
export function stageChange(before: TipContext, after: TipContext, tipStages: readonly Stage[]): StageChange {
  const direction = rank(after.stage) > rank(before.stage) ? 'up' : rank(after.stage) < rank(before.stage) ? 'down' : null;
  const newTips = tipStages
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => isTipUnlocked(s, after) && !isTipUnlocked(s, before))
    .sort((a, b) => rank(a.s) - rank(b.s))
    .map(({ i }) => i);
  return { direction, stage: after.stage, newTips };
}
