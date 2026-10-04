import { essentialsFigure } from './targets';
import { startingPoint } from './placement';
import type { PlacementAnswers } from './placement';
import type { RiskRecord } from './risk';
import type { AccountType, CardDebt } from './types';

/**
 * How much of placement the student answered.
 * - `complete`: all 5 questions answered ("Not sure" counts as an answer).
 * - `partial`: skipped partway, with at least one answer kept.
 * - `skipped`: skipped with nothing answered.
 */
export type PlacementStatus = 'complete' | 'partial' | 'skipped';

/** What placement stored. A null field was never answered (unknown). */
export interface Profile {
  placementStatus: PlacementStatus;
  essentials: string | null;
  essentialsExactCents: number | null;
  /** The essentials figure used for targets, in cents. Null when unknown. */
  essentialsCents: number | null;
  savings: string | null;
  savingsExactCents: number | null;
  accounts: AccountType[] | null;
  cardDebt: CardDebt | null;
  earnedIncome: boolean | null;
  /** Internal only. Null when essentials are unknown. */
  monthsCovered: number | null;
  /** The risk quiz (Start investing). Null until it is taken or skipped. Retaking placement never clears it. */
  risk: RiskRecord | null;
}

export function placementStatus(answers: PlacementAnswers): PlacementStatus {
  const answered = [
    answers.essentials,
    answers.savings,
    answers.accounts,
    answers.cardDebt,
    answers.earnedIncome,
  ].filter((a) => a !== undefined).length;
  if (answered === 5) return 'complete';
  return answered === 0 ? 'skipped' : 'partial';
}

export function profileFromAnswers(answers: PlacementAnswers): Profile {
  const figure = answers.essentials === undefined ? null : essentialsFigure(answers.essentials, answers.essentialsExactCents);
  return {
    placementStatus: placementStatus(answers),
    essentials: answers.essentials ?? null,
    essentialsExactCents: answers.essentialsExactCents ?? null,
    essentialsCents: figure?.cents ?? null,
    savings: answers.savings ?? null,
    savingsExactCents: answers.savingsExactCents ?? null,
    accounts: answers.accounts ? [...answers.accounts] : null,
    cardDebt: answers.cardDebt ?? null,
    earnedIncome: answers.earnedIncome ?? null,
    monthsCovered: startingPoint(answers).monthsCovered,
    risk: null,
  };
}

/** Current answers, for prefilling a retake. Null fields stay unanswered. */
export function answersFromProfile(profile: Profile): PlacementAnswers {
  const answers: PlacementAnswers = {};
  if (profile.essentials !== null) answers.essentials = profile.essentials;
  if (profile.essentialsExactCents !== null) answers.essentialsExactCents = profile.essentialsExactCents;
  if (profile.savings !== null) answers.savings = profile.savings;
  if (profile.savingsExactCents !== null) answers.savingsExactCents = profile.savingsExactCents;
  if (profile.accounts !== null) answers.accounts = profile.accounts;
  if (profile.cardDebt !== null) answers.cardDebt = profile.cardDebt;
  if (profile.earnedIncome !== null) answers.earnedIncome = profile.earnedIncome;
  return answers;
}
