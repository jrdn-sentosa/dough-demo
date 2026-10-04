import { beforeEach, describe, expect, it } from 'vitest';
import { pointsTotal } from '../domain/points';
import { advance } from '../money/clock';
import { deposit, startLoaf, withdraw } from '../money/ledger';
import type { DataAdapter } from './adapter';
import { createMemoryAdapter } from './memoryAdapter';
import { normalizeAppData } from './normalize';
import { awardVideoPoint, syncPoints } from './points';
import { recordQuizAttempt } from './progress';
import { emptyData } from './types';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

const keys = async () => (await adapter.load()).points.map((p) => p.key);
const total = async () => pointsTotal((await adapter.load()).points);

const grade = (score: number) => ({ score, total: 5, results: [], missed: [] });

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await startLoaf(adapter, EF, dollars(5000));
});

describe('syncPoints: the fund holds steady', () => {
  it('gives nothing before a day has finished', async () => {
    await deposit(adapter, EF, dollars(20));
    expect(await syncPoints(adapter)).toMatchObject({ changed: false });
    expect(await total()).toBe(0);
  });

  it('back-fills a point for each finished day since the first deposit', async () => {
    await deposit(adapter, EF, dollars(20));
    await advance(adapter, 3);
    const result = await syncPoints(adapter);
    expect(result.changed).toBe(true);
    expect(await total()).toBe(3);
    expect((await keys()).every((k) => k.startsWith('fund-day:'))).toBe(true);
  });

  it('is safe to run again: nothing is awarded twice', async () => {
    await deposit(adapter, EF, dollars(20));
    await advance(adapter, 3);
    await syncPoints(adapter);
    const before = await adapter.load();
    expect(await syncPoints(adapter)).toMatchObject({ changed: false, added: [] });
    expect((await adapter.load()).points).toEqual(before.points);
  });

  it('skips only the day the balance fell, and never takes a point back', async () => {
    await deposit(adapter, EF, dollars(20));
    await advance(adapter, 1);
    await withdraw(adapter, EF, dollars(5));
    await advance(adapter, 2);
    await syncPoints(adapter);
    // Day 1 ends at $20, day 2 ends lower ($15, no point), day 3 holds at $15.
    expect(await total()).toBe(2);
    await advance(adapter, 2);
    await syncPoints(adapter);
    expect(await total()).toBe(4);
  });

  it('counts the emergency fund only, once a day', async () => {
    await startLoaf(adapter, 'roth-ira', dollars(500));
    await deposit(adapter, 'roth-ira', dollars(50));
    await advance(adapter, 2);
    await syncPoints(adapter);
    expect(await total()).toBe(0);
  });
});

describe('syncPoints: mastery and bakes', () => {
  it('awards 5 for mastery once, however many mastering attempts', async () => {
    await recordQuizAttempt(adapter, EF, 'lesson', grade(3), {});
    await syncPoints(adapter);
    expect(await keys()).toEqual([]);
    await recordQuizAttempt(adapter, EF, 'lesson', grade(4), {});
    await recordQuizAttempt(adapter, EF, 'lesson', grade(5), {});
    await syncPoints(adapter);
    await syncPoints(adapter);
    expect(await keys()).toEqual(['mastery:emergency-fund']);
    expect(await total()).toBe(5);
  });

  it('does not count a test-out', async () => {
    await recordQuizAttempt(adapter, EF, 'test-out', grade(5), {});
    await syncPoints(adapter);
    expect(await total()).toBe(0);
  });

  it('awards 10 for a bake, and nothing for rebuilding to the same goal', async () => {
    const baked = await deposit(adapter, EF, dollars(5000));
    expect(baked.ok && baked.baked).toBe(true);
    await syncPoints(adapter);
    expect(await keys()).toContain('bake:emergency-fund:500000');

    await withdraw(adapter, EF, dollars(1000));
    const rebuilt = await deposit(adapter, EF, dollars(1000));
    expect(rebuilt.ok && rebuilt.rebuilt).toBe(true);
    await syncPoints(adapter);
    expect((await keys()).filter((k) => k.startsWith('bake:'))).toEqual(['bake:emergency-fund:500000']);
  });

  it('gives nothing for a bake that was "Already built"', async () => {
    const data = emptyData();
    data.loaves.push({
      loafId: EF,
      targetCents: dollars(1000),
      startedAt: '2026-01-01T00:00:00.000Z',
      bread: 'sandwich',
      bakes: [{ targetCents: dollars(1000), at: null, bread: 'sandwich' }],
      growFromCents: null,
    });
    const fresh = createMemoryAdapter(data);
    await syncPoints(fresh);
    expect((await fresh.load()).points).toEqual([]);
  });
});

describe('video points', () => {
  it('are given once per lesson', async () => {
    expect(await awardVideoPoint(adapter, 'ef-what-its-for')).toBe(true);
    expect(await awardVideoPoint(adapter, 'ef-what-its-for')).toBe(false);
    expect(await awardVideoPoint(adapter, 'ef-how-much')).toBe(true);
    expect(await keys()).toEqual(expect.arrayContaining(['video:ef-what-its-for', 'video:ef-how-much']));
    expect(await total()).toBe(2);
  });

  it('are not given for marking a lesson watched', async () => {
    const { markLessonWatched } = await import('./progress');
    await markLessonWatched(adapter, EF, 'ef-what-its-for', 'manual');
    await syncPoints(adapter);
    expect(await total()).toBe(0);
  });
});

describe('writes that start together', () => {
  it('both land: a video point and a sync do not overwrite each other', async () => {
    await deposit(adapter, EF, dollars(20));
    await advance(adapter, 2);
    await Promise.all([syncPoints(adapter), awardVideoPoint(adapter, 'ef-what-its-for'), syncPoints(adapter)]);
    const k = await keys();
    expect(k).toContain('video:ef-what-its-for');
    expect(k.filter((x) => x.startsWith('fund-day:'))).toHaveLength(2);
  });
});

describe('loading saved points', () => {
  it('drops duplicate keys and rows that would take points away', () => {
    const data = emptyData();
    const at = '2026-10-01T00:00:00.000Z';
    data.points = [
      { key: 'video:a', kind: 'video', points: 1, at, ref: 'a' },
      { key: 'video:a', kind: 'video', points: 9, at, ref: 'a' },
      { key: 'video:b', kind: 'video', points: -1, at, ref: 'b' },
      { key: 'video:c', kind: 'video', points: 0, at, ref: 'c' },
      { key: 'video:d', kind: 'video', points: 1.5, at, ref: 'd' },
      { key: 'odd:e', kind: 'nope' as 'video', points: 1, at, ref: 'e' },
    ];
    expect(normalizeAppData(data).points).toEqual([{ key: 'video:a', kind: 'video', points: 1, at, ref: 'a' }]);
  });

  it('starts with no points when saved data has none', () => {
    const old = { ...emptyData() } as Partial<ReturnType<typeof emptyData>>;
    delete old.points;
    delete old.dailyQuizzes;
    const loaded = normalizeAppData(old as ReturnType<typeof emptyData>);
    expect(loaded.points).toEqual([]);
    expect(loaded.dailyQuizzes).toEqual([]);
  });
});
