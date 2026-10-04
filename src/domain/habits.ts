const FIVE_DOLLARS = 500;
const SEMESTER_WEEKS = 12;

export const PAYCHECK_PERCENT = 10;

export interface HabitSuggestions {
  weeklyCents: number;
  paycheckPercent: number;
}

/** Target over about one semester (12 weeks), rounded up to the nearest $5, at least $5. */
export function suggestWeeklyCents(targetCents: number): number {
  const perWeek = Math.ceil(targetCents / SEMESTER_WEEKS / FIVE_DOLLARS) * FIVE_DOLLARS;
  return Math.max(FIVE_DOLLARS, perWeek);
}

export function suggestPerPaycheckCents(paycheckCents: number): number {
  return Math.round((paycheckCents * PAYCHECK_PERCENT) / 100);
}

/** Both are offered. Placement doesn't ask income type, so the student chooses. */
export function suggestHabits(targetCents: number): HabitSuggestions {
  return { weeklyCents: suggestWeeklyCents(targetCents), paycheckPercent: PAYCHECK_PERCENT };
}

/** How often a student is paid. `varies` has no regular period to track. */
export type PayFrequency = 'weekly' | 'biweekly' | 'twice-monthly' | 'monthly' | 'varies';

export const PAY_FREQUENCIES: readonly PayFrequency[] = ['weekly', 'biweekly', 'twice-monthly', 'monthly', 'varies'];

/**
 * The student's saving habit. A plan, not a balance: balances only come from transaction rows.
 * - `weekly`: a set amount each week.
 * - `paycheck`: 10% of each paycheck, tracked over the pay period (`frequency`).
 */
export interface Habit {
  kind: 'weekly' | 'paycheck';
  /** What to move each period, in cents. For `paycheck`, the 10% of `paycheckCents` (editable). */
  amountCents: number;
  /** The paycheck the 10% was worked out from. Null for `weekly`. */
  paycheckCents: number | null;
  /** Null for `weekly`. */
  frequency: PayFrequency | null;
  /** ISO string in UTC from the demo clock. Periods are counted from here. */
  startedAt: string;
}

/** The habit saved by "Skip for now": the suggested weekly amount. */
export function defaultHabit(targetCents: number, startedAt: string): Habit {
  return { kind: 'weekly', amountCents: suggestWeeklyCents(targetCents), paycheckCents: null, frequency: null, startedAt };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Length of one tracked period in days. Twice a month is 15 days and monthly is 30,
 * counted from the day the habit started, so the demo clock's "Skip a week" always lands
 * in a new period. Null for "it varies".
 */
export function habitPeriodDays(habit: Habit): number | null {
  if (habit.kind === 'weekly') return 7;
  switch (habit.frequency) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'twice-monthly':
      return 15;
    case 'monthly':
      return 30;
    default:
      return null;
  }
}

export interface HabitPeriod {
  /** False for "it varies": there is no logged / not logged status, only `lastAddedAt`. */
  tracked: boolean;
  /** Which period the demo clock is in, counting from 0 at `startedAt`. Null when not tracked. */
  index: number | null;
  /** A deposit landed in the current period. Always false when not tracked. */
  logged: boolean;
  /** ISO time of the latest deposit, or null if there is none. */
  lastAddedAt: string | null;
}

/**
 * Where the habit stands at `now` (from the demo clock). `depositTimes` are the ISO times of the
 * loaf's deposits. Deposits before the habit started don't count toward its first period.
 */
export function habitPeriod(habit: Habit, depositTimes: readonly string[], now: Date): HabitPeriod {
  const times = depositTimes.map((t) => new Date(t).getTime()).sort((a, b) => a - b);
  const last = times.length > 0 ? times[times.length - 1] : null;
  const lastAddedAt = last === null ? null : new Date(last).toISOString();
  const days = habitPeriodDays(habit);
  if (days === null) return { tracked: false, index: null, logged: false, lastAddedAt };

  const startMs = new Date(habit.startedAt).getTime();
  const index = Math.max(0, Math.floor((now.getTime() - startMs) / (days * DAY_MS)));
  const windowStart = startMs + index * days * DAY_MS;
  const windowEnd = windowStart + days * DAY_MS;
  const logged = times.some((t) => t >= windowStart && t < windowEnd);
  return { tracked: true, index, logged, lastAddedAt };
}
