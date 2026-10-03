import type { AccountType, CardDebt, LoafId } from './types';

/** The emergency fund is grown to this many months. */
export const GROW_TARGET_MONTHS = 3;

export interface NextLoafInput {
  cardDebt: CardDebt;
  earnedIncome: boolean;
  accounts: readonly AccountType[];
  /**
   * Months of essentials the emergency fund target that just baked covered
   * (see `monthsForTarget`). Null or missing means not applicable.
   */
  targetMonths?: number | null;
}

export interface NextLoaf {
  loaf: LoafId;
  /** Show the note that paying off high-interest debt usually comes before investing. */
  debtNote: boolean;
  /**
   * Set when the recommendation is "Grow your cushion to 3 months": the same
   * emergency fund loaf, with a bigger target (`setTarget` with `grow: true`).
   */
  growTargetMonths: typeof GROW_TARGET_MONTHS | null;
}

/**
 * Order: card debt, then growing a cushion under 3 months, then Roth IRA, then Index funds.
 * "Not sure" about accounts counts as no retirement account. Roth IRA needs earned income.
 */
export function recommendNext({ cardDebt, earnedIncome, accounts, targetMonths }: NextLoafInput): NextLoaf {
  if (cardDebt === 'yes') return { loaf: 'debt-payoff', debtNote: true, growTargetMonths: null };
  if (targetMonths != null && targetMonths < GROW_TARGET_MONTHS) {
    return { loaf: 'emergency-fund', debtNote: false, growTargetMonths: GROW_TARGET_MONTHS };
  }
  if (earnedIncome && !accounts.includes('retirement')) {
    return { loaf: 'roth-ira', debtNote: false, growTargetMonths: null };
  }
  return { loaf: 'index-funds', debtNote: false, growTargetMonths: null };
}
