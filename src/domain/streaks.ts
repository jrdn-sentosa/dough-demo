import { habitPeriodDays } from './habits';
import type { Habit } from './habits';
import { LADDER, UNLOCKABLE_BREADS } from './breads';
import type { BreadId, UnlockableBread } from './breads';

const DAY_MS = 24 * 60 * 60 * 1000;

/** "It varies" has no regular pay period, so a streak counts by month (30 days). */
const VARIES_PERIOD_DAYS = 30;

/** Length of one streak period in days: the habit's period, or 30 for "it varies". */
export function streakPeriodDays(habit: Habit): number {
  return habitPeriodDays(habit) ?? VARIES_PERIOD_DAYS;
}

/** The name of one period, for display: a week, a pay period, or a month. */
export type StreakUnit = 'week' | 'pay-period' | 'month';

export function streakUnit(habit: Habit): StreakUnit {
  const days = streakPeriodDays(habit);
  if (days === 7) return 'week';
  return days === 30 ? 'month' : 'pay-period';
}

/**
 * Consecutive habit periods with a deposit, counted back from now.
 * - Periods are fixed windows from `habit.startedAt`, like the habit card.
 * - Only deposits count (the caller passes deposit times), so withdrawals never break a streak.
 * - Deposits before the habit started don't count.
 * - A period still in progress with no deposit yet doesn't end the streak: it only ends once the period is over.
 */
export function currentStreak(habit: Habit, depositTimes: readonly string[], now: Date): number {
  const periodMs = streakPeriodDays(habit) * DAY_MS;
  const startMs = new Date(habit.startedAt).getTime();
  const withDeposit = new Set<number>();
  for (const t of depositTimes) {
    const ms = new Date(t).getTime();
    if (ms >= startMs) withDeposit.add(Math.floor((ms - startMs) / periodMs));
  }
  const nowIndex = Math.max(0, Math.floor((now.getTime() - startMs) / periodMs));
  let index = withDeposit.has(nowIndex) ? nowIndex : nowIndex - 1;
  let count = 0;
  while (index >= 0 && withDeposit.has(index)) {
    count += 1;
    index -= 1;
  }
  return count;
}

/** Whole days a streak covers. Unlocks compare days with the ladder's weeks x 7, so the unit doesn't matter. */
export function streakDays(habit: Habit, streak: number): number {
  return streak * streakPeriodDays(habit);
}

/** Weeks of consistent saving: streak periods x period days / 7. */
export function weeksCovered(habit: Habit, streak: number): number {
  return streakDays(habit, streak) / 7;
}

/** Ladder breads the streak has reached (every one whose weeks are covered). */
export function breadsReached(habit: Habit, streak: number): UnlockableBread[] {
  const days = streakDays(habit, streak);
  return LADDER.filter((rung) => days >= rung.weeks * 7).map((rung) => rung.bread);
}

/** Whole weeks still to go for a bread, rounded up. 0 once the streak covers it. */
export function weeksLeft(habit: Habit, streak: number, bread: UnlockableBread): number {
  const rung = LADDER.find((r) => r.bread === bread);
  if (!rung) return 0;
  return Math.max(0, Math.ceil((rung.weeks * 7 - streakDays(habit, streak)) / 7));
}

/** The first ladder bread that isn't unlocked yet, with the weeks it takes in total. Null when all are unlocked. */
export function nextUnlock(unlocked: readonly BreadId[]): { bread: UnlockableBread; weeks: number } | null {
  return LADDER.find((rung) => !unlocked.includes(rung.bread)) ?? null;
}

/** The highest bread on the ladder that is unlocked, or null. */
export function latestUnlocked(unlocked: readonly BreadId[]): UnlockableBread | null {
  const have = UNLOCKABLE_BREADS.filter((b) => unlocked.includes(b));
  return have.length > 0 ? have[have.length - 1] : null;
}
