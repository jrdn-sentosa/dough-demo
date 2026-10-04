import type { AccountType, CardDebt } from './types';

/** The emergency fund is grown to this many months (the recommended step). */
export const GROW_TARGET_MONTHS = 3;
/** A fund that already covers 3 months can grow to this many (offered, never recommended). */
export const GROW_FURTHER_MONTHS = 6;

/** Every field can be unknown (undefined) when placement was skipped or only partly answered. */
export interface NextLoafInput {
  cardDebt?: CardDebt;
  earnedIncome?: boolean;
  accounts?: readonly AccountType[];
  /**
   * Months of essentials the emergency fund target that just baked covered
   * (see `monthsForTarget`). Null or missing means not applicable.
   */
  targetMonths?: number | null;
  /** The fund's target was the starter goal, so its months are unknown. */
  targetIsDefault?: boolean;
}

/** The two paths on "Choose your next loaf". */
export type NextPath = 'save' | 'invest';

export interface NextLoaf {
  /**
   * Which path gets the "Recommended" pill. Null when nothing is recommended: an answer it needs
   * is unknown (`needsPersonalization`), or card debt is yes (the debt note speaks instead).
   */
  path: NextPath | null;
  /**
   * An answer the pick depends on is unknown. ChooseLoaf shows "Answer a few quick questions for a
   * personalized pick" (opens placement) instead of a recommendation. Both paths stay choosable.
   */
  needsPersonalization: boolean;
  /** Card debt is yes: "Paying off high-interest debt usually comes before investing" comes first on the invest path. */
  debtNote: boolean;
  /** Card debt is unknown, so the invest path asks the debt question (personalization) before the risk quiz. */
  debtUnknown: boolean;
  /**
   * What Keep saving offers: grow to 3 months (recommended) when the fund that baked covered
   * under 3 months or was the starter goal, grow to 6 months when it covered 3 or more but under 6
   * (never recommended). Null when Keep saving isn't offered.
   */
  growTargetMonths: typeof GROW_TARGET_MONTHS | typeof GROW_FURTHER_MONTHS | null;
  /** Growing needs the essentials question first, because essentials are unknown. */
  growNeedsEssentials: boolean;
}

/**
 * Order for the "Recommended" pill:
 * 1. The fund that baked covered under 3 months, or was the starter goal: Keep saving
 *    (grow to 3 months). It only depends on the target, so unknown answers don't block it.
 * 2. Card debt unknown: no pill, personalize. The debt check is never skipped.
 * 3. Card debt yes: no pill. The invest path leads with the debt note.
 * 4. Otherwise: Start investing.
 * Keep saving at 6 months is offered for a fund that covered 3 months or more but under 6, and is never recommended.
 */
export function recommendNext({ cardDebt, targetMonths, targetIsDefault }: NextLoafInput): NextLoaf {
  const base = {
    debtNote: cardDebt === 'yes',
    debtUnknown: cardDebt === undefined,
  };
  if (targetIsDefault || (targetMonths != null && targetMonths < GROW_TARGET_MONTHS)) {
    return {
      ...base,
      path: 'save',
      needsPersonalization: false,
      growTargetMonths: GROW_TARGET_MONTHS,
      growNeedsEssentials: targetIsDefault === true,
    };
  }
  const further: NextLoaf['growTargetMonths'] =
    targetMonths != null && targetMonths >= GROW_TARGET_MONTHS && targetMonths < GROW_FURTHER_MONTHS
      ? GROW_FURTHER_MONTHS
      : null;
  const rest = { ...base, growTargetMonths: further, growNeedsEssentials: false };
  if (cardDebt === undefined) return { ...rest, path: null, needsPersonalization: true };
  if (cardDebt === 'yes') return { ...rest, path: null, needsPersonalization: false };
  return { ...rest, path: 'invest', needsPersonalization: false };
}
