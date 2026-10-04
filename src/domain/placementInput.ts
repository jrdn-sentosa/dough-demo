import { DEFAULT_GOAL_CENTS } from './bands';
import type { PlacementAnswers, StartingPoint } from './placement';
import type { PlacementQuestionId } from './retake';
import { targetForMonths } from './targets';
import type { AccountType, CardDebt } from './types';

/** What the student has picked so far, by question id. Multi-select answers are lists. */
export type Selections = Partial<Record<PlacementQuestionId, string | string[]>>;

/** Picking "None of these" or "Not sure" clears the other choices, and picking a real account clears them. */
export function toggleAccount(current: readonly string[], id: string): string[] {
  if (id === 'none' || id === 'not-sure') return current.includes(id) ? [] : [id];
  const real = current.filter((a) => a !== 'none' && a !== 'not-sure');
  return real.includes(id) ? real.filter((a) => a !== id) : [...real, id];
}

/** Turns on-screen selections into placement answers. Anything not picked stays unknown. */
export function answersFromSelections(sel: Selections): PlacementAnswers {
  const answers: PlacementAnswers = {};
  if (typeof sel.essentials === 'string') answers.essentials = sel.essentials;
  if (typeof sel['existing-savings'] === 'string') answers.savings = sel['existing-savings'];
  if (Array.isArray(sel.accounts) && sel.accounts.length > 0) answers.accounts = sel.accounts as AccountType[];
  if (typeof sel['card-debt'] === 'string') answers.cardDebt = sel['card-debt'] as CardDebt;
  if (typeof sel['earned-income'] === 'string') answers.earnedIncome = sel['earned-income'] === 'yes';
  return answers;
}

/**
 * The reverse of `answersFromSelections`, for prefilling a retake with the current answers.
 * Unknown answers stay unselected.
 */
export function selectionsFromAnswers(answers: PlacementAnswers): Selections {
  const sel: Selections = {};
  if (answers.essentials !== undefined) sel.essentials = answers.essentials;
  if (answers.savings !== undefined) sel['existing-savings'] = answers.savings;
  if (answers.accounts !== undefined && answers.accounts.length > 0) sel.accounts = [...answers.accounts];
  if (answers.cardDebt !== undefined) sel['card-debt'] = answers.cardDebt;
  if (answers.earnedIncome !== undefined) sel['earned-income'] = answers.earnedIncome ? 'yes' : 'no';
  return sel;
}

/** A path the retake may return to: inside the app only, never another site. */
export function safeReturnPath(path: string | null | undefined): string {
  return path && /^\/(?!\/)/.test(path) ? path : '/';
}

/**
 * The target recorded on the loaf when the fund counts as baked at the start.
 * It is the biggest of 1 or 3 months that the savings cover, so a student with
 * 3+ months isn't asked to "grow" a goal they've already passed.
 * With unknown essentials it is the starter goal.
 */
export function bakedStartTargetCents(start: StartingPoint): number {
  const essentials = start.essentialsCents;
  if (essentials === null) return DEFAULT_GOAL_CENTS;
  return start.existingSavingsCents >= targetForMonths(essentials, 3)
    ? targetForMonths(essentials, 3)
    : targetForMonths(essentials, 1);
}
