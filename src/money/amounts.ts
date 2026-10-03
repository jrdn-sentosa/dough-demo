import { formatCents } from './format';

/** Deposits and withdrawals: a single entry over this is probably a typo. */
export const MAX_ENTRY_CENTS = 10_000_00;
/** Savings the student already had: allowed up to this, with a confirmation above MAX_ENTRY_CENTS. */
export const MAX_STARTING_CENTS = 100_000_00;

export type AmountErrorCode = 'not-whole' | 'not-positive' | 'too-large';

export interface AmountFailure {
  ok: false;
  code: AmountErrorCode;
  message: string;
}

/** Positive integer cents only. */
export function checkAmount(amountCents: number, maxCents: number): AmountFailure | null {
  if (!Number.isInteger(amountCents)) {
    return { ok: false, code: 'not-whole', message: 'Please enter a dollar amount, like 25 or 12.50.' };
  }
  if (amountCents <= 0) {
    return { ok: false, code: 'not-positive', message: 'Please enter an amount greater than $0.' };
  }
  if (amountCents > maxCents) {
    return {
      ok: false,
      code: 'too-large',
      message: `That's more than ${formatCents(maxCents)} in one go. Double-check the amount for a typo.`,
    };
  }
  return null;
}
