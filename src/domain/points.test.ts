import { describe, expect, it } from 'vitest';
import { addDays, endOfDayIso, localDayKey } from './days';
import {
  POINT_VALUES,
  addNewEvents,
  bakeEvents,
  bakeKey,
  fundHoldDays,
  historyNewestFirst,
  masteryEvents,
  pointEvent,
  pointsTotal,
} from './points';

/** Dates are built in local time, so these tests pass in any timezone. */
const local = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h).toISOString();

describe('local days', () => {
  it('names the local calendar day, near midnight too', () => {
    expect(localDayKey(new Date(2026, 9, 5, 0, 1))).toBe('2026-10-05');
    expect(localDayKey(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(localDayKey(local(10, 6, 0))).toBe('2026-10-06');
  });

  it('adds days across month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('ends a day at its last millisecond', () => {
    const end = endOfDayIso('2026-10-05');
    expect(localDayKey(end)).toBe('2026-10-05');
    expect(localDayKey(new Date(new Date(end).getTime() + 1))).toBe('2026-10-06');
  });
});

describe('fundHoldDays', () => {
  const series = (...ends: number[]) => ends.map((endCents, i) => ({ day: addDays('2026-10-01', i), endCents }));

  it('earns on a first day with money and on every day it holds or grows', () => {
    expect(fundHoldDays(series(500, 500, 700))).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('earns nothing while the balance is zero', () => {
    expect(fundHoldDays(series(0, 0, 100))).toEqual(['2026-10-03']);
  });

  it('skips a day the balance fell, then earns again the next day it holds', () => {
    expect(fundHoldDays(series(1000, 400, 400, 450))).toEqual(['2026-10-01', '2026-10-03', '2026-10-04']);
  });

  it('earns nothing on a day that ends at zero after a full withdrawal', () => {
    expect(fundHoldDays(series(1000, 0, 0))).toEqual(['2026-10-01']);
  });

  it('is empty for no days', () => {
    expect(fundHoldDays([])).toEqual([]);
  });
});

describe('ledger', () => {
  const a = pointEvent('fund-day', 'fund-day:2026-10-01', '2026-10-01', local(10, 1));

  it('never adds a key twice and leaves existing rows alone', () => {
    const again = { ...a, points: 99 };
    const b = pointEvent('video', 'video:ef-what-its-for', 'ef-what-its-for', local(10, 2));
    const { ledger, added } = addNewEvents([a], [again, b, b]);
    expect(added).toEqual([b]);
    expect(ledger).toEqual([a, b]);
  });

  it('adds up points and lists history newest first', () => {
    const b = pointEvent('mastery', 'mastery:emergency-fund', 'emergency-fund', local(10, 3));
    expect(pointsTotal([a, b])).toBe(POINT_VALUES['fund-day'] + POINT_VALUES.mastery);
    expect(historyNewestFirst([a, b]).map((e) => e.key)).toEqual([b.key, a.key]);
  });

  it('gives only positive whole points', () => {
    for (const value of Object.values(POINT_VALUES)) {
      expect(Number.isInteger(value) && value > 0).toBe(true);
    }
  });
});

describe('mastery and bake awards', () => {
  const attempt = (score: number, at: string, mode: 'lesson' | 'test-out' = 'lesson') => ({
    loafId: 'emergency-fund' as const,
    mode,
    score,
    total: 5,
    at,
  });

  it('awards mastery once, dated by the first attempt that reached 4 of 5', () => {
    const events = masteryEvents([attempt(2, local(10, 1)), attempt(4, local(10, 2)), attempt(5, local(10, 3))], ['emergency-fund']);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ key: 'mastery:emergency-fund', points: 5, at: local(10, 2) });
  });

  it('awards nothing below 4, or for a test-out', () => {
    expect(masteryEvents([attempt(3, local(10, 1)), attempt(5, local(10, 2), 'test-out')], ['emergency-fund'])).toEqual([]);
  });

  it('awards a bake per target, and nothing for "Already built"', () => {
    const events = bakeEvents([
      {
        loafId: 'emergency-fund',
        bakes: [
          { targetCents: 0, at: null },
          { targetCents: 40_000, at: local(10, 4) },
          { targetCents: 120_000, at: local(11, 20) },
        ],
      },
    ]);
    expect(events.map((e) => e.key)).toEqual([bakeKey('emergency-fund', 40_000), bakeKey('emergency-fund', 120_000)]);
    expect(events.every((e) => e.points === 10)).toBe(true);
  });
});
