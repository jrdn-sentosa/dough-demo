import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { streakFromData } from '../data/streaks';
import { skipWeek, skipWeekWithoutSaving } from './demo';
import { getLoafStatus, startLoaf } from './ledger';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await startLoaf(adapter, EF, dollars(5000));
});

describe('skipWeek', () => {
  it('asks for a habit first and changes nothing', async () => {
    expect(await skipWeek(adapter, EF)).toMatchObject({ ok: false, code: 'no-habit' });
    const data = await adapter.load();
    expect(data.transactions).toEqual([]);
    expect(data.clock.offsetDays).toBe(0);
  });

  it('adds one seed deposit of the habit amount, then moves the clock 7 days', async () => {
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    const result = await skipWeek(adapter, EF);
    expect(result.ok).toBe(true);
    const data = await adapter.load();
    expect(data.transactions).toHaveLength(1);
    expect(data.transactions[0]).toMatchObject({ type: 'deposit', source: 'seed', amountCents: dollars(35) });
    expect(data.clock.offsetDays).toBe(7);
    expect((await getLoafStatus(adapter, EF))?.balanceCents).toBe(dollars(35));
  });

  it('builds a streak, and unlocks the baguette on the second week', async () => {
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    const first = await skipWeek(adapter, EF);
    if (!first.ok) throw new Error(first.message);
    expect(first.unlocked).toEqual([]);
    const second = await skipWeek(adapter, EF);
    if (!second.ok) throw new Error(second.message);
    expect(second.unlocked).toEqual(['baguette']);
    expect(streakFromData(await adapter.load())).toBe(2);
  });

  it('reports a bake when the deposit reaches the target', async () => {
    const small = createMemoryAdapter();
    await startLoaf(small, EF, dollars(30));
    await saveHabit(small, { kind: 'weekly', amountCents: dollars(35) });
    const result = await skipWeek(small, EF);
    if (!result.ok) throw new Error(result.message);
    expect(result.deposit.baked).toBe(true);
  });
});

describe('skipWeekWithoutSaving', () => {
  it('only moves the clock: no row is written', async () => {
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    await skipWeekWithoutSaving(adapter);
    const data = await adapter.load();
    expect(data.transactions).toEqual([]);
    expect(data.clock.offsetDays).toBe(7);
  });

  it('lets a streak start over without taking an unlock away', async () => {
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    await skipWeek(adapter, EF);
    await skipWeek(adapter, EF);
    await skipWeekWithoutSaving(adapter);
    await skipWeekWithoutSaving(adapter);
    const data = await adapter.load();
    expect(streakFromData(data)).toBe(0);
    expect(data.streaks.unlocked.map((u) => u.bread)).toEqual(['baguette']);
  });
});
