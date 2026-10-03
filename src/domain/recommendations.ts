import type { AccountType, CardDebt, LoafId } from './types';

export interface NextLoafInput {
  cardDebt: CardDebt;
  earnedIncome: boolean;
  accounts: readonly AccountType[];
}

export interface NextLoaf {
  loaf: LoafId;
  /** Show the note that paying off high-interest debt usually comes before investing. */
  debtNote: boolean;
}

/** "Not sure" about accounts counts as no retirement account. Roth IRA needs earned income. */
export function recommendNext({ cardDebt, earnedIncome, accounts }: NextLoafInput): NextLoaf {
  if (cardDebt === 'yes') return { loaf: 'debt-payoff', debtNote: true };
  if (earnedIncome && !accounts.includes('retirement')) {
    return { loaf: 'roth-ira', debtNote: false };
  }
  return { loaf: 'index-funds', debtNote: false };
}
