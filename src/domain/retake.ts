import { DEFAULT_GOAL_CENTS } from './bands';
import { accountRules, startingPoint } from './placement';
import type { PlacementAnswers } from './placement';
import { answersFromProfile, profileFromAnswers } from './profile';
import type { Profile } from './profile';
import { creditedSavings, essentialsFigure, targetForMonths } from './targets';

export type PlacementQuestionId =
  | 'essentials'
  | 'existing-savings'
  | 'accounts'
  | 'card-debt'
  | 'earned-income';

const ALL_QUESTIONS: readonly PlacementQuestionId[] = [
  'essentials',
  'existing-savings',
  'accounts',
  'card-debt',
  'earned-income',
];

/**
 * Settings, "Retake the quiz": which questions to ask. When the loaf already has
 * transactions, the existing-savings question is skipped, because that money is
 * already tracked.
 */
export function questionsToAsk(loafHasTransactions: boolean): readonly PlacementQuestionId[] {
  return loafHasTransactions ? ALL_QUESTIONS.filter((q) => q !== 'existing-savings') : ALL_QUESTIONS;
}

export interface RetakeInput {
  /** Answers from the profile (use `answersFromProfile`). Prefill the retake with these. */
  current: PlacementAnswers;
  /** What the student answered this time. Unanswered questions keep their current answer. */
  next: PlacementAnswers;
  /** The loaf in progress, or null when there is none. */
  loaf: { targetCents: number; hasTransactions: boolean } | null;
}

export interface RetakeResult {
  answers: PlacementAnswers;
  /** The profile to store. A retake never touches transactions. */
  profile: Profile;
  /** Ask "Update your goal to {amount}?". Null when nothing suggests a different goal. Never applied silently. */
  suggestedTargetCents: number | null;
  needsHysaStep: boolean;
  whereToKeepOptional: boolean;
}

function defined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Combines current answers with the new ones. A new essentials answer brings its exact amount with it. */
function mergeAnswers(current: PlacementAnswers, next: PlacementAnswers, loafHasTransactions: boolean): PlacementAnswers {
  const merged: PlacementAnswers = { ...current, ...defined(next) };
  if (next.essentials !== undefined) merged.essentialsExactCents = next.essentialsExactCents;
  if (loafHasTransactions) {
    merged.savings = current.savings;
    merged.savingsExactCents = current.savingsExactCents;
  } else if (next.savings !== undefined) {
    merged.savingsExactCents = next.savingsExactCents;
  }
  return defined(merged);
}

const savedCents = (a: PlacementAnswers) =>
  a.savings === undefined ? 0 : creditedSavings(a.savings, a.savingsExactCents);
const essentialsOf = (a: PlacementAnswers) =>
  a.essentials === undefined ? null : essentialsFigure(a.essentials, a.essentialsExactCents).cents;

/**
 * Works out the goal to suggest after a retake, or null.
 * - Nothing is suggested unless the essentials or savings answer changed.
 * - Loaf with no transactions yet: the full starting point is recomputed.
 * - Loaf with transactions, target is the starter goal and essentials are now
 *   known: 1 month of the new essentials.
 * - Loaf with transactions, target is 1, 3 or 6 months of the old essentials:
 *   the same number of months, re-priced.
 * - Anything else (a custom amount) is left alone.
 */
function suggestTarget(current: PlacementAnswers, merged: PlacementAnswers, loaf: RetakeInput['loaf']): number | null {
  if (!loaf) return null;
  const before = essentialsOf(current);
  const after = essentialsOf(merged);
  if (after === null) return null;
  if (before === after && savedCents(current) === savedCents(merged)) return null;

  let suggested: number | null;
  if (!loaf.hasTransactions) {
    suggested = startingPoint(merged).targetCents;
  } else if (before === null) {
    suggested = loaf.targetCents === DEFAULT_GOAL_CENTS ? targetForMonths(after, 1) : null;
  } else {
    const months = ([1, 3, 6] as const).find((m) => targetForMonths(before, m) === loaf.targetCents);
    suggested = months === undefined ? null : targetForMonths(after, months);
  }
  return suggested !== null && suggested !== loaf.targetCents ? suggested : null;
}

export function retake({ current, next, loaf }: RetakeInput): RetakeResult {
  const merged = mergeAnswers(current, next, loaf?.hasTransactions ?? false);
  return {
    answers: merged,
    profile: profileFromAnswers(merged),
    suggestedTargetCents: suggestTarget(current, merged, loaf),
    ...accountRules(merged.accounts),
  };
}

/** Convenience for callers that hold a stored profile. */
export function retakeFromProfile(profile: Profile, next: PlacementAnswers, loaf: RetakeInput['loaf']): RetakeResult {
  return retake({ current: answersFromProfile(profile), next, loaf });
}
