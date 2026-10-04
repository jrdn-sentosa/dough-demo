import { describe, expect, it } from 'vitest';
import type { Habit } from '../domain/habits';
import { advance } from '../money/clock';
import { startLoaf } from '../money/ledger';
import { restartsStreak, saveHabit } from './habit';
import { createMemoryAdapter } from './memoryAdapter';

// The note shown in Settings before a habit change is saved. It must agree with what saveHabit does to the start date.
const weekly: Habit = { kind: 'weekly', amountCents: 4_000, paycheckCents: null, frequency: null, startedAt: '2026-08-01T00:00:00.000Z' };

describe('restartsStreak', () => {
  it('is false with no habit yet', () => {
    expect(restartsStreak(null, { kind: 'weekly', amountCents: 1_000 })).toBe(false);
  });

  it('is false when only the amount changes', () => {
    expect(restartsStreak(weekly, { kind: 'weekly', amountCents: 9_000 })).toBe(false);
  });

  it('is false for ways of being paid that share a period length (paid weekly and a weekly habit)', () => {
    expect(restartsStreak(weekly, { kind: 'paycheck', amountCents: 2_000, paycheckCents: 20_000, frequency: 'weekly' })).toBe(false);
  });

  it('is true when the period length changes', () => {
    expect(restartsStreak(weekly, { kind: 'paycheck', amountCents: 4_000, paycheckCents: 40_000, frequency: 'biweekly' })).toBe(true);
    expect(restartsStreak(weekly, { kind: 'paycheck', amountCents: 4_000, paycheckCents: 40_000, frequency: 'monthly' })).toBe(true);
  });

  it('agrees with what saveHabit does to the start date', async () => {
    const adapter = createMemoryAdapter();
    await startLoaf(adapter, 'emergency-fund', 40_000);
    const first = await saveHabit(adapter, { kind: 'weekly', amountCents: 4_000 });
    await advance(adapter, 10);
    const input = { kind: 'paycheck', amountCents: 4_000, paycheckCents: 40_000, frequency: 'biweekly' } as const;
    expect(restartsStreak(first, input)).toBe(true);
    expect((await saveHabit(adapter, input)).startedAt).not.toBe(first.startedAt);
    const again = await saveHabit(adapter, { ...input, amountCents: 5_000 });
    expect(restartsStreak(again, { ...input, amountCents: 6_000 })).toBe(false);
  });
});
