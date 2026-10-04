import type { BreadId, UnlockableBread } from '../domain/breads';
import { breadsReached, currentStreak, streakDays } from '../domain/streaks';
import { nowFromData } from '../money/clock';
import type { DataAdapter } from './adapter';
import type { AppData } from './types';

/** The student's current streak in periods, worked out from the habit and every deposit row. Never stored. */
export function streakFromData(data: AppData): number {
  if (!data.habit) return 0;
  const deposits = data.transactions.filter((t) => t.type === 'deposit').map((t) => t.at);
  return currentStreak(data.habit, deposits, nowFromData(data));
}

/** Every bread the student has unlocked, in the order they were earned. */
export function unlockedBreads(data: AppData): UnlockableBread[] {
  return data.streaks.unlocked.map((u) => u.bread);
}

/** The first unlock the student hasn't dismissed on Home yet, or null. */
export function unseenUnlock(data: AppData): UnlockableBread | null {
  return data.streaks.unlocked.find((u) => !u.seen)?.bread ?? null;
}

/**
 * Records any ladder bread the current streak has reached and raises the best streak.
 * Safe to call as often as needed: it only writes when something changed. Unlocks are permanent,
 * so a streak that later resets never takes one away.
 * `fresh` is the breads unlocked by this call, and `changed` says whether anything was written
 * (a new best streak counts), so a screen knows when to reload its data.
 */
export async function syncStreaks(adapter: DataAdapter): Promise<{ fresh: UnlockableBread[]; changed: boolean }> {
  const data = await adapter.load();
  if (!data.habit) return { fresh: [], changed: false };
  const streak = streakFromData(data);
  const days = streakDays(data.habit, streak);
  const known = new Set<BreadId>(unlockedBreads(data));
  const fresh = breadsReached(data.habit, streak).filter((b) => !known.has(b));
  const bestDays = Math.max(data.streaks.bestDays, days);
  if (fresh.length === 0 && bestDays === data.streaks.bestDays) return { fresh: [], changed: false };

  const at = nowFromData(data).toISOString();
  data.streaks = {
    unlocked: [...data.streaks.unlocked, ...fresh.map((bread) => ({ bread, at, seen: false }))],
    bestDays,
  };
  await adapter.save(data);
  return { fresh, changed: true };
}

/** Dismissing the unlock moment on Home. */
export async function markUnlockSeen(adapter: DataAdapter, bread: UnlockableBread): Promise<void> {
  const data = await adapter.load();
  const unlock = data.streaks.unlocked.find((u) => u.bread === bread);
  if (!unlock || unlock.seen) return;
  unlock.seen = true;
  await adapter.save(data);
}
