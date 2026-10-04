import { describe, expect, it } from 'vitest';
import { LADDER, UNLOCKABLE_BREADS, availableBreads, weeksFor } from './breads';
import type { Habit, PayFrequency } from './habits';
import { breadsReached, currentStreak, latestUnlocked, nextUnlock, streakPeriodDays, streakUnit, weeksCovered, weeksLeft } from './streaks';

const DAY = 24 * 60 * 60 * 1000;
const START = new Date('2026-01-01T12:00:00.000Z').getTime();
const at = (day: number) => new Date(START + day * DAY).toISOString();
const now = (day: number) => new Date(START + day * DAY);

function habitFor(frequency: PayFrequency | 'weekly-habit'): Habit {
  if (frequency === 'weekly-habit') return { kind: 'weekly', amountCents: 1500, paycheckCents: null, frequency: null, startedAt: at(0) };
  return { kind: 'paycheck', amountCents: 5000, paycheckCents: 50000, frequency, startedAt: at(0) };
}

/** A deposit in each of the first `n` periods of `days` days, then the clock moves to the start of period `n`. */
function saveFor(habit: Habit, n: number): { deposits: string[]; clock: Date } {
  const days = streakPeriodDays(habit);
  return { deposits: Array.from({ length: n }, (_, i) => at(i * days + 1)), clock: now(n * days) };
}

describe('streak periods', () => {
  it('uses the habit period, and 30 days for "it varies"', () => {
    expect(streakPeriodDays(habitFor('weekly-habit'))).toBe(7);
    expect(streakPeriodDays(habitFor('weekly'))).toBe(7);
    expect(streakPeriodDays(habitFor('biweekly'))).toBe(14);
    expect(streakPeriodDays(habitFor('twice-monthly'))).toBe(15);
    expect(streakPeriodDays(habitFor('monthly'))).toBe(30);
    expect(streakPeriodDays(habitFor('varies'))).toBe(30);
  });

  it('names the unit: week, pay period or month', () => {
    expect(streakUnit(habitFor('weekly-habit'))).toBe('week');
    expect(streakUnit(habitFor('weekly'))).toBe('week');
    expect(streakUnit(habitFor('biweekly'))).toBe('pay-period');
    expect(streakUnit(habitFor('twice-monthly'))).toBe('pay-period');
    expect(streakUnit(habitFor('monthly'))).toBe('month');
    expect(streakUnit(habitFor('varies'))).toBe('month');
  });
});

describe('currentStreak', () => {
  const weekly = habitFor('weekly-habit');

  it('is 0 with no deposits', () => {
    expect(currentStreak(weekly, [], now(0))).toBe(0);
    expect(currentStreak(weekly, [], now(30))).toBe(0);
  });

  it('counts consecutive periods with a deposit', () => {
    expect(currentStreak(weekly, [at(1), at(8), at(15)], now(16))).toBe(3);
  });

  it('counts the current period once it has a deposit', () => {
    expect(currentStreak(weekly, [at(1), at(8)], now(9))).toBe(2);
  });

  it('does not end the streak while the current period is still in progress with no deposit', () => {
    expect(currentStreak(weekly, [at(1), at(8)], now(14))).toBe(2);
  });

  it('ends the streak once a whole period has passed with no deposit, and starts again from zero', () => {
    expect(currentStreak(weekly, [at(1), at(8)], now(21))).toBe(0);
    expect(currentStreak(weekly, [at(1), at(8), at(22)], now(23))).toBe(1);
  });

  it('counts two deposits in one period once', () => {
    expect(currentStreak(weekly, [at(1), at(2), at(3)], now(4))).toBe(1);
  });

  it('ignores deposits from before the habit started', () => {
    expect(currentStreak(weekly, [at(-3), at(-10)], now(2))).toBe(0);
  });

  it('only sees deposit times, so withdrawals and starting rows can never break it', () => {
    // The caller passes deposit rows only; a streak built from deposits is the same whatever else is in the ledger.
    expect(currentStreak(weekly, [at(1), at(8), at(15)], now(16))).toBe(3);
  });

  it('counts a 30-day period for "it varies"', () => {
    const varies = habitFor('varies');
    expect(currentStreak(varies, [at(5), at(40)], now(41))).toBe(2);
    expect(currentStreak(varies, [at(5), at(40)], now(100))).toBe(0);
  });

  it('works for every pay frequency', () => {
    for (const f of ['weekly', 'biweekly', 'twice-monthly', 'monthly', 'varies'] as const) {
      const h = habitFor(f);
      const { deposits, clock } = saveFor(h, 3);
      expect(currentStreak(h, deposits, clock)).toBe(3);
    }
  });
});

describe('unlocks are measured in weeks of saving', () => {
  it('has the ladder in weeks', () => {
    expect(LADDER.map((r) => [r.bread, r.weeks])).toEqual([
      ['baguette', 2],
      ['bagel', 4],
      ['focaccia', 6],
      ['pretzel', 8],
      ['brioche', 12],
      ['croissant', 16],
    ]);
    expect(LADDER.map((r) => r.bread)).toEqual([...UNLOCKABLE_BREADS]);
  });

  it('turns periods into weeks: periods x period days / 7', () => {
    expect(weeksCovered(habitFor('weekly-habit'), 4)).toBe(4);
    expect(weeksCovered(habitFor('biweekly'), 3)).toBe(6);
    expect(weeksCovered(habitFor('monthly'), 2)).toBeCloseTo(60 / 7);
  });

  it('weekly and every-two-weeks students reach each bread after exactly the same number of weeks', () => {
    const weekly = habitFor('weekly-habit');
    const biweekly = habitFor('biweekly');
    for (const { bread, weeks } of LADDER) {
      // Weekly: the streak that reaches it is `weeks` periods long, and one fewer is not enough.
      expect(breadsReached(weekly, weeks)).toContain(bread);
      expect(breadsReached(weekly, weeks - 1)).not.toContain(bread);
      // Every two weeks: weeks / 2 periods, and one fewer is not enough.
      expect(breadsReached(biweekly, weeks / 2)).toContain(bread);
      expect(breadsReached(biweekly, weeks / 2 - 1)).not.toContain(bread);
    }
  });

  it('a monthly student unlocks at the first whole month that covers the weeks, and never earlier', () => {
    const monthly = habitFor('monthly');
    for (const { bread, weeks } of LADDER) {
      const months = Math.ceil((weeks * 7) / 30);
      expect(breadsReached(monthly, months)).toContain(bread);
      expect(breadsReached(monthly, months - 1)).not.toContain(bread);
    }
  });

  it('twice a month works the same way, in 15-day periods', () => {
    const twice = habitFor('twice-monthly');
    for (const { bread, weeks } of LADDER) {
      const periods = Math.ceil((weeks * 7) / 15);
      expect(breadsReached(twice, periods)).toContain(bread);
      expect(breadsReached(twice, periods - 1)).not.toContain(bread);
    }
  });

  it('a bread is reached exactly when the weeks covered reach its rung, whatever the unit', () => {
    for (const f of ['weekly', 'biweekly', 'twice-monthly', 'monthly', 'varies'] as const) {
      const h = habitFor(f);
      for (let streak = 0; streak <= 20; streak++) {
        const reached = breadsReached(h, streak);
        for (const { bread, weeks } of LADDER) {
          expect(reached.includes(bread)).toBe(weeksCovered(h, streak) >= weeks);
        }
      }
    }
  });

  it('shows time left in weeks, rounded up', () => {
    const weekly = habitFor('weekly-habit');
    expect(weeksLeft(weekly, 0, 'bagel')).toBe(4);
    expect(weeksLeft(weekly, 3, 'bagel')).toBe(1);
    expect(weeksLeft(weekly, 4, 'bagel')).toBe(0);
    expect(weeksLeft(habitFor('biweekly'), 1, 'bagel')).toBe(2);
    expect(weeksLeft(habitFor('monthly'), 1, 'focaccia')).toBe(2); // 30 of 42 days: 12 days left, up to 2 weeks
  });

  it('finds the next unlock from what is unlocked, and the latest', () => {
    expect(nextUnlock([])).toEqual({ bread: 'baguette', weeks: 2 });
    expect(nextUnlock(['baguette', 'bagel'])).toEqual({ bread: 'focaccia', weeks: 6 });
    expect(nextUnlock([...UNLOCKABLE_BREADS])).toBeNull();
    expect(latestUnlocked([])).toBeNull();
    expect(latestUnlocked(['baguette', 'bagel'])).toBe('bagel');
  });

  it('offers the default plus unlocked breads, in ladder order', () => {
    expect(availableBreads([])).toEqual(['sandwich']);
    expect(availableBreads(['bagel', 'baguette'])).toEqual(['sandwich', 'baguette', 'bagel']);
    expect(weeksFor('pretzel')).toBe(8);
  });
});
