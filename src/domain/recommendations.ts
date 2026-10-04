import type { AccountType, CardDebt, LoafId } from './types';

/** The emergency fund is grown to this many months. */
export const GROW_TARGET_MONTHS = 3;

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

export interface NextLoaf {
  /** Null when `needsPersonalization`: there is no recommendation yet. */
  loaf: LoafId | null;
  /**
   * An answer the pick depends on is unknown. ChooseLoaf shows "Answer a few
   * quick questions for a personalized pick" (opens placement). Every loaf stays choosable.
   */
  needsPersonalization: boolean;
  /** Show the note that paying off high-interest debt usually comes before investing. */
  debtNote: boolean;
  /**
   * Set when the recommendation is "Grow your cushion to 3 months": the same
   * emergency fund loaf, with a bigger target (`setTarget` with `grow: true`).
   */
  growTargetMonths: typeof GROW_TARGET_MONTHS | null;
  /** Growing needs the essentials question first, because essentials are unknown. */
  growNeedsEssentials: boolean;
}

const pick = (loaf: LoafId): NextLoaf => ({
  loaf,
  needsPersonalization: false,
  debtNote: false,
  growTargetMonths: null,
  growNeedsEssentials: false,
});

/**
 * Order:
 * 1. Card debt "yes": Debt payoff.
 * 2. Fund target under 3 months (or the starter goal): Grow your cushion. It only
 *    depends on the target, so unknown answers don't block it.
 * 3. Card debt unknown: personalize. The debt check is never skipped.
 * 4. A retirement account, or no earned income: Index funds.
 * 5. Earned income and no retirement account: Roth IRA. "Not sure" about accounts
 *    counts as no retirement account. Never recommended with unknown income or accounts.
 * 6. Anything else is unknown: personalize.
 */
export function recommendNext({
  cardDebt,
  earnedIncome,
  accounts,
  targetMonths,
  targetIsDefault,
}: NextLoafInput): NextLoaf {
  if (cardDebt === 'yes') return { ...pick('debt-payoff'), debtNote: true };
  if (targetIsDefault || (targetMonths != null && targetMonths < GROW_TARGET_MONTHS)) {
    return {
      ...pick('emergency-fund'),
      growTargetMonths: GROW_TARGET_MONTHS,
      growNeedsEssentials: targetIsDefault === true,
    };
  }
  const personalize: NextLoaf = { ...pick('index-funds'), loaf: null, needsPersonalization: true };
  if (cardDebt === undefined) return personalize;
  if (accounts?.includes('retirement') || earnedIncome === false) return pick('index-funds');
  if (earnedIncome === true && accounts !== undefined) return pick('roth-ira');
  return personalize;
}
