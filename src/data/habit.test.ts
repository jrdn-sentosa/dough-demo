import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from './adapter';
import { markTipSeen, saveDefaultHabit, saveHabit, setHysaCard } from './habit';
import { STORAGE_KEY, createLocalAdapter } from './localAdapter';
import { createMemoryAdapter } from './memoryAdapter';
import { addHighYieldAccount, savePlacement } from './profile';
import { emptyData } from './types';
import { accountRules } from '../domain/placement';
import { answersFromProfile } from '../domain/profile';
import { advance, nowIso } from '../money/clock';
import { deposit, startLoaf } from '../money/ledger';

const EF = 'emergency-fund';
let adapter: DataAdapter;

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await startLoaf(adapter, EF, 40_000);
});

describe('saving habit', () => {
  it('saves a weekly habit, dated by the demo clock', async () => {
    await advance(adapter, 3);
    const habit = await saveHabit(adapter, { kind: 'weekly', amountCents: 3_000 });
    expect(habit).toMatchObject({ kind: 'weekly', amountCents: 3_000, paycheckCents: null, frequency: null });
    expect((await adapter.load()).habit).toEqual(habit);
    // Three days past real time, to within the test's own run time.
    const ahead = new Date(habit.startedAt).getTime() - new Date(await nowIso(adapter)).getTime();
    expect(Math.abs(ahead)).toBeLessThan(5_000);
    expect(new Date(habit.startedAt).getTime()).toBeGreaterThan(Date.now() + 2 * 24 * 60 * 60 * 1000);
  });

  it('saves a paycheck habit with its frequency and the paycheck it came from', async () => {
    const habit = await saveHabit(adapter, { kind: 'paycheck', amountCents: 2_500, paycheckCents: 25_000, frequency: 'twice-monthly' });
    expect(habit).toMatchObject({ kind: 'paycheck', amountCents: 2_500, paycheckCents: 25_000, frequency: 'twice-monthly' });
  });

  it("\"Skip for now\" saves the suggested weekly amount for the loaf's target", async () => {
    const habit = await saveDefaultHabit(adapter);
    expect(habit).toMatchObject({ kind: 'weekly', amountCents: 3_500 }); // $400 / 12 = $33.33 -> $35
    expect((await adapter.load()).habit).toEqual(habit);
  });

  it('has nothing to save a default for without a loaf', async () => {
    expect(await saveDefaultHabit(createMemoryAdapter())).toBeNull();
  });

  it('never writes a transaction', async () => {
    await saveHabit(adapter, { kind: 'weekly', amountCents: 3_000 });
    expect((await adapter.load()).transactions).toEqual([]);
  });
});

describe('tips seen', () => {
  it('remembers an opened tip once', async () => {
    await markTipSeen(adapter, 'emergency-fund:proof');
    await markTipSeen(adapter, 'emergency-fund:proof');
    expect((await adapter.load()).tipsSeen).toEqual(['emergency-fund:proof']);
  });
});

describe('"I have one now"', () => {
  it("adds high-yield savings to the profile's accounts, so a retake shows it selected", async () => {
    await savePlacement(adapter, { accounts: ['checking'], cardDebt: 'no' });
    await setHysaCard(adapter, 'pending');
    const profile = await addHighYieldAccount(adapter);
    expect(profile?.accounts).toEqual(['checking', 'high-yield-savings']);
    const data = await adapter.load();
    expect(answersFromProfile(data.profile!).accounts).toContain('high-yield-savings');
    expect(data.hysaCard).toBeNull();
    // Later loaves don't ask about it, and the lesson becomes optional.
    expect(accountRules(data.profile!.accounts ?? undefined)).toEqual({ needsHysaStep: false, whereToKeepOptional: true });
  });

  it('starts the list when accounts were skipped, and drops "None" and "Not sure"', async () => {
    await savePlacement(adapter, { cardDebt: 'no' });
    expect((await addHighYieldAccount(adapter))?.accounts).toEqual(['high-yield-savings']);
    await savePlacement(adapter, { accounts: ['none'] });
    expect((await addHighYieldAccount(adapter))?.accounts).toEqual(['high-yield-savings']);
    await savePlacement(adapter, { accounts: ['not-sure', 'checking'] });
    expect((await addHighYieldAccount(adapter))?.accounts).toEqual(['checking', 'high-yield-savings']);
  });

  it('is safe to repeat and keeps the rest of the profile and every transaction', async () => {
    await savePlacement(adapter, { essentials: '250-499', accounts: ['checking'], earnedIncome: true });
    await deposit(adapter, EF, 2_000);
    const before = await adapter.load();
    await addHighYieldAccount(adapter);
    await addHighYieldAccount(adapter);
    const after = await adapter.load();
    expect(after.profile?.accounts).toEqual(['checking', 'high-yield-savings']);
    expect({ ...after.profile, accounts: null }).toEqual({ ...before.profile, accounts: null });
    expect(after.transactions).toEqual(before.transactions);
    expect(after.loaves).toEqual(before.loaves);
  });

  it('does nothing without a profile', async () => {
    expect(await addHighYieldAccount(adapter)).toBeNull();
  });
});

describe('older saved data', () => {
  it('loads with no habit, no seen tips and no reminder', async () => {
    const old: Record<string, unknown> = { ...emptyData() };
    delete old.habit;
    delete old.tipsSeen;
    delete old.hysaCard;
    const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(old)]]);
    const local = createLocalAdapter({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    const data = await local.load();
    expect(data.habit).toBeNull();
    expect(data.tipsSeen).toEqual([]);
    expect(data.hysaCard).toBeNull();
  });
});
