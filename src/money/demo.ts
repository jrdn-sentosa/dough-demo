import type { DataAdapter } from '../data/adapter';
import { syncStreaks } from '../data/streaks';
import type { UnlockableBread } from '../domain/breads';
import type { LoafId } from '../domain/types';
import { advance } from './clock';
import { deposit } from './ledger';
import type { DepositResult, MoneyFailure } from './ledger';

/** Demo tools only (`?demo=1`): the simulated week-by-week testing of habits and streaks. Nothing here moves real money. */

export interface SkipWeekResult {
  ok: true;
  deposit: DepositResult;
  /** Breads this week's saving unlocked. */
  unlocked: UnlockableBread[];
}

/**
 * "Skip a week": one simulated deposit of the habit amount, then the demo clock moves forward 7 days,
 * so the deposit lands in the week that just ended and a streak builds. The row is marked `seed`
 * because it is demo data, not something the student typed.
 */
export async function skipWeek(adapter: DataAdapter, loafId: LoafId): Promise<SkipWeekResult | MoneyFailure> {
  const data = await adapter.load();
  if (!data.habit) {
    return { ok: false, code: 'no-habit', message: 'Pick a saving habit first, then skip ahead.' };
  }
  const result = await deposit(adapter, loafId, data.habit.amountCents, { source: 'seed' });
  if (!result.ok) return result;
  await advance(adapter, 7);
  return { ok: true, deposit: result, unlocked: (await syncStreaks(adapter)).fresh };
}

/** "Skip a week without saving": only the clock moves, so a missed week can be tested. */
export async function skipWeekWithoutSaving(adapter: DataAdapter): Promise<void> {
  await advance(adapter, 7);
}
