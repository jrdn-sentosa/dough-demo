import type { DataAdapter } from '../data/adapter';
import { syncStreaks } from '../data/streaks';
import type { UnlockableBread } from '../domain/breads';
import type { LoafId } from '../domain/types';
import { DEMO_EMAIL } from '../data/session';
import { emptyData } from '../data/types';
import { advance, realNow } from './clock';
import { deposit } from './ledger';
import type { DepositResult, MoneyFailure } from './ledger';
import { mayaSeed } from './seed';

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

const NOT_DEMO = "Demo tools only work for the demo user, never for an account.";

/**
 * "Continue as demo user": Maya, seeded on a blank device. If this browser already holds demo data
 * (an earlier session, or a "Start fresh demo" in progress) it is kept, so Exit demo then Continue picks up where they left off.
 */
export async function signInAsMaya(adapter: DataAdapter, realNowMs?: () => number): Promise<void> {
  const data = await adapter.load();
  if (data.profile || data.loaves.length > 0) {
    data.user = { email: DEMO_EMAIL };
    await adapter.save(data);
    return;
  }
  await adapter.save(mayaSeed(realNow(realNowMs)));
}

/**
 * "Reset demo": puts Maya's seed back and the demo clock at real time. Refuses unless the signed-in user is the
 * local demo user, so it can never touch a real account's data.
 */
export async function resetDemo(adapter: DataAdapter, realNowMs?: () => number): Promise<{ ok: true } | MoneyFailure> {
  const data = await adapter.load();
  if (data.user?.email !== DEMO_EMAIL) return { ok: false, code: 'not-demo', message: NOT_DEMO };
  await adapter.save(mayaSeed(realNow(realNowMs)));
  return { ok: true };
}

/**
 * "Start fresh demo": wipes this device's demo data and starts a plain demo user at the placement quiz.
 * Same guard as Reset, except it also works from the login screen (nobody signed in, no account).
 */
export async function startFreshDemo(adapter: DataAdapter): Promise<{ ok: true } | MoneyFailure> {
  const data = await adapter.load();
  if (data.user && data.user.email !== DEMO_EMAIL) return { ok: false, code: 'not-demo', message: NOT_DEMO };
  const fresh = emptyData();
  fresh.user = { email: DEMO_EMAIL };
  await adapter.save(fresh);
  return { ok: true };
}
