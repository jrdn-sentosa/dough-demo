import { defaultHabit } from '../domain/habits';
import type { Habit, PayFrequency } from '../domain/habits';
import { streakPeriodDays } from '../domain/streaks';
import { nowIso } from '../money/clock';
import type { DataAdapter } from './adapter';
import type { HysaCardState } from './types';

export type HabitInput =
  | { kind: 'weekly'; amountCents: number }
  | { kind: 'paycheck'; amountCents: number; paycheckCents: number; frequency: PayFrequency };

/**
 * The start date for a habit that replaces `previous`. Periods (and so streak windows) are counted from it,
 * so it only moves when the period length changes, which is when the old windows no longer fit.
 * Changing just the amount, or between ways of being paid that share a period length, keeps the streak.
 */
function startFor(previous: Habit | null, next: Habit): string {
  return previous && streakPeriodDays(previous) === streakPeriodDays(next) ? previous.startedAt : next.startedAt;
}

function habitFromInput(input: HabitInput, startedAt: string): Habit {
  return input.kind === 'weekly'
    ? { kind: 'weekly', amountCents: input.amountCents, paycheckCents: null, frequency: null, startedAt }
    : { kind: 'paycheck', amountCents: input.amountCents, paycheckCents: input.paycheckCents, frequency: input.frequency, startedAt };
}

/** Whether saving `input` over `previous` restarts the streak: only when the period length changes. A new amount never does. */
export function restartsStreak(previous: Habit | null, input: HabitInput): boolean {
  return previous !== null && streakPeriodDays(previous) !== streakPeriodDays(habitFromInput(input, previous.startedAt));
}

/** Saves the habit from Saving setup or Settings. The start date comes from the demo clock; periods are counted from it. */
export async function saveHabit(adapter: DataAdapter, input: HabitInput): Promise<Habit> {
  const data = await adapter.load();
  const next = habitFromInput(input, await nowIso(adapter));
  data.habit = { ...next, startedAt: startFor(data.habit, next) };
  await adapter.save(data);
  return data.habit;
}

/** "Skip for now" on the habit step: the suggested weekly amount for the loaf's target. Null if there is no loaf. */
export async function saveDefaultHabit(adapter: DataAdapter, loafId = 'emergency-fund'): Promise<Habit | null> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return null;
  const next = defaultHabit(loaf.targetCents, await nowIso(adapter));
  data.habit = { ...next, startedAt: startFor(data.habit, next) };
  await adapter.save(data);
  return data.habit;
}

/** Opening a tip clears its "New" badge. Opening it again changes nothing. */
export async function markTipSeen(adapter: DataAdapter, id: string): Promise<void> {
  const data = await adapter.load();
  if (data.tipsSeen.includes(id)) return;
  data.tipsSeen.push(id);
  await adapter.save(data);
}

export async function setHysaCard(adapter: DataAdapter, state: HysaCardState): Promise<void> {
  const data = await adapter.load();
  data.hysaCard = state;
  await adapter.save(data);
}
