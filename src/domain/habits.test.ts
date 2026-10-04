import { describe, expect, it } from 'vitest';
import { defaultHabit, habitPeriod, habitPeriodDays, suggestHabits, suggestPerPaycheckCents, suggestWeeklyCents } from './habits';
import type { Habit, PayFrequency } from './habits';

describe('suggestWeeklyCents', () => {
  it('divides the target over 12 weeks, rounded up to $5', () => {
    expect(suggestWeeklyCents(40_000)).toBe(3_500); // $33.33 -> $35
    expect(suggestWeeklyCents(60_000)).toBe(5_000); // exactly $50
    expect(suggestWeeklyCents(60_100)).toBe(5_500);
  });

  it('is at least $5', () => {
    expect(suggestWeeklyCents(15_000)).toBe(1_500);
    expect(suggestWeeklyCents(1_000)).toBe(500);
    expect(suggestWeeklyCents(0)).toBe(500);
  });
});

describe('suggestPerPaycheckCents', () => {
  it('is 10% of each paycheck', () => {
    expect(suggestPerPaycheckCents(50_000)).toBe(5_000);
    expect(suggestPerPaycheckCents(33_333)).toBe(3_333);
  });
});

describe('suggestHabits', () => {
  it('offers both options', () => {
    expect(suggestHabits(40_000)).toEqual({ weeklyCents: 3_500, paycheckPercent: 10 });
  });
});

describe("habit period (the habit card's week logic)", () => {
  const DAY = 24 * 60 * 60 * 1000;
  const start = '2026-03-02T12:00:00.000Z';
  const startMs = new Date(start).getTime();
  const at = (days: number) => new Date(startMs + days * DAY);
  const iso = (days: number) => at(days).toISOString();
  const weekly: Habit = { kind: 'weekly', amountCents: 3_500, paycheckCents: null, frequency: null, startedAt: start };
  const paycheck = (frequency: PayFrequency): Habit => ({ kind: 'paycheck', amountCents: 2_000, paycheckCents: 20_000, frequency, startedAt: start });

  it('is not logged until a deposit lands in the current week', () => {
    expect(habitPeriod(weekly, [], at(1))).toMatchObject({ tracked: true, index: 0, logged: false, lastAddedAt: null });
    expect(habitPeriod(weekly, [iso(2)], at(3))).toMatchObject({ index: 0, logged: true });
  });

  it("starts a new week every 7 days, so last week's deposit no longer counts", () => {
    const deposits = [iso(2)];
    expect(habitPeriod(weekly, deposits, at(6.9)).logged).toBe(true);
    const next = habitPeriod(weekly, deposits, at(7));
    expect(next).toMatchObject({ index: 1, logged: false, lastAddedAt: iso(2) });
    expect(habitPeriod(weekly, [...deposits, iso(8)], at(9)).logged).toBe(true);
  });

  it('follows the demo clock: skipping a week with a deposit leaves the new week not logged', () => {
    // "Skip a week" adds a deposit, then moves the clock forward 7 days.
    expect(habitPeriod(weekly, [iso(1)], at(1)).logged).toBe(true);
    expect(habitPeriod(weekly, [iso(1)], at(8)).logged).toBe(false);
    expect(habitPeriod(weekly, [iso(1)], at(8)).index).toBe(1);
  });

  it('does not count a deposit from before the habit started', () => {
    expect(habitPeriod(weekly, [iso(-3)], at(0)).logged).toBe(false);
  });

  it('stays in the first week if the clock is reset to before the habit started', () => {
    expect(habitPeriod(weekly, [], at(-10)).index).toBe(0);
  });

  it('tracks the matching period for each pay frequency', () => {
    const deposit = [iso(1)];
    expect(habitPeriodDays(paycheck('weekly'))).toBe(7);
    expect(habitPeriodDays(paycheck('biweekly'))).toBe(14);
    expect(habitPeriodDays(paycheck('twice-monthly'))).toBe(15);
    expect(habitPeriodDays(paycheck('monthly'))).toBe(30);
    // Every two weeks: a deposit on day 1 still counts on day 13, not on day 14.
    expect(habitPeriod(paycheck('biweekly'), deposit, at(13)).logged).toBe(true);
    expect(habitPeriod(paycheck('biweekly'), deposit, at(14)).logged).toBe(false);
    expect(habitPeriod(paycheck('twice-monthly'), deposit, at(14)).logged).toBe(true);
    expect(habitPeriod(paycheck('twice-monthly'), deposit, at(15)).logged).toBe(false);
    expect(habitPeriod(paycheck('monthly'), deposit, at(29)).logged).toBe(true);
    expect(habitPeriod(paycheck('monthly'), deposit, at(30)).logged).toBe(false);
    expect(habitPeriod(paycheck('weekly'), deposit, at(8)).logged).toBe(false);
  });

  it('"it varies" has no logged status, only when they last added', () => {
    const varies = paycheck('varies');
    expect(habitPeriodDays(varies)).toBeNull();
    expect(habitPeriod(varies, [], at(5))).toEqual({ tracked: false, index: null, logged: false, lastAddedAt: null });
    expect(habitPeriod(varies, [iso(4), iso(1)], at(30))).toEqual({ tracked: false, index: null, logged: false, lastAddedAt: iso(4) });
  });

  it('the skip default is the suggested weekly amount, started now', () => {
    expect(defaultHabit(40_000, start)).toEqual({ kind: 'weekly', amountCents: 3_500, paycheckCents: null, frequency: null, startedAt: start });
  });
});
