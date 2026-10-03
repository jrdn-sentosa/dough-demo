import type { LoafId } from '../domain/types';

/** `starting` is savings the student already had when they began the loaf. */
export type TransactionType = 'starting' | 'deposit' | 'withdrawal';

/** One raw row. The amount is always positive; the sign comes from `type`. */
export interface Transaction {
  id: string;
  loafId: LoafId;
  type: TransactionType;
  amountCents: number;
  /** ISO string in UTC, always taken from the demo clock. */
  at: string;
}

export interface LoafRecord {
  loafId: LoafId;
  targetCents: number;
  startedAt: string;
  /** Set once, the first time deposits reach the target. Never cleared. */
  firstBakedAt: string | null;
  /** Existing savings already covered the target, so there is no completion date. */
  bakedAtStart: boolean;
}

export interface ClockState {
  /** Whole days the demo clock has been moved forward from real time. */
  offsetDays: number;
}

/** Local-only fake sign-in. Replaced by Supabase auth in milestone 10. */
export interface LocalUser {
  email: string;
}

export interface AppData {
  version: 1;
  user: LocalUser | null;
  loaves: LoafRecord[];
  transactions: Transaction[];
  clock: ClockState;
}

export function emptyData(): AppData {
  return { version: 1, user: null, loaves: [], transactions: [], clock: { offsetDays: 0 } };
}
