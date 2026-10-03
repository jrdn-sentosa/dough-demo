import type { LoafId } from '../domain/types';

/** `starting` is savings the student already had when they began the loaf. */
export type TransactionType = 'starting' | 'deposit' | 'withdrawal';

/** Where a row came from: typed in by the student, read from a linked bank (Plaid milestone), or demo seed data. */
export type TransactionSource = 'manual' | 'plaid' | 'seed';

export const TRANSACTION_SOURCES: readonly TransactionSource[] = ['manual', 'plaid', 'seed'];

/** One raw row. The amount is always positive; the sign comes from `type`. */
export interface Transaction {
  id: string;
  loafId: LoafId;
  type: TransactionType;
  source: TransactionSource;
  amountCents: number;
  /** ISO string in UTC, always taken from the demo clock. */
  at: string;
}

/** One bake on the shelf. A fund that has been grown has more than one. */
export interface Bake {
  /** The target that was reached. The shelf turns it into months using the student's essentials. */
  targetCents: number;
  /** ISO string in UTC from the demo clock, or null for "Already built" (existing savings covered it). */
  at: string | null;
}

export interface LoafRecord {
  loafId: LoafId;
  targetCents: number;
  startedAt: string;
  /**
   * Every bake, oldest first. Never cleared by withdrawals, so the shelf keeps
   * the first bake. A new entry is added only when a higher target is reached.
   */
  bakes: Bake[];
  /**
   * Set while the student grows a baked fund toward a bigger target: the old
   * target, where the new growth starts. Cleared by a withdrawal or the next bake.
   */
  growFromCents: number | null;
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
