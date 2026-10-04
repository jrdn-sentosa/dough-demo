import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from './adapter';
import { STORAGE_KEY, createLocalAdapter } from './localAdapter';
import { createMemoryAdapter } from './memoryAdapter';
import { loadProfile, retakePlacement, savePlacement } from './profile';
import { addStarting, deposit, startLoaf } from '../money/ledger';
import type { PlacementAnswers } from '../domain/placement';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

const maya: PlacementAnswers = {
  essentials: '250-499',
  savings: 'none',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

let adapter: DataAdapter;

beforeEach(() => {
  adapter = createMemoryAdapter();
});

describe('placement profile', () => {
  it('starts as null', async () => {
    expect(await loadProfile(adapter)).toBeNull();
  });

  it('stores a skipped placement as skipped', async () => {
    await savePlacement(adapter, {});
    expect(await loadProfile(adapter)).toMatchObject({ placementStatus: 'skipped', essentials: null });
  });

  it('stores a partial placement with the answers given', async () => {
    await savePlacement(adapter, { essentials: '500-749', cardDebt: 'yes' });
    expect(await loadProfile(adapter)).toMatchObject({
      placementStatus: 'partial',
      essentialsCents: 65_000,
      cardDebt: 'yes',
      accounts: null,
    });
  });

  it('stores a complete placement', async () => {
    await savePlacement(adapter, maya);
    expect(await loadProfile(adapter)).toMatchObject({ placementStatus: 'complete', monthsCovered: 0 });
  });

  it('old saved data without a profile loads with profile: null', async () => {
    const old = { version: 1, user: null, loaves: [], transactions: [], clock: { offsetDays: 0 } };
    const store = new Map([[STORAGE_KEY, JSON.stringify(old)]]);
    const local = createLocalAdapter({
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
    });
    expect((await local.load()).profile).toBeNull();
  });
});

describe('retaking placement', () => {
  async function setup(withTransactions: boolean, targetDollars = 400) {
    await savePlacement(adapter, maya);
    await startLoaf(adapter, EF, dollars(targetDollars));
    if (withTransactions) {
      await addStarting(adapter, EF, dollars(50));
      await deposit(adapter, EF, dollars(100));
    }
  }

  it('without transactions: updates the profile and suggests a goal without changing it', async () => {
    await setup(false);
    const r = await retakePlacement(adapter, { essentials: '500-749', savings: '100-249' });
    expect(r.suggestedTargetCents).toBe(dollars(650));
    const data = await adapter.load();
    expect(data.profile).toMatchObject({ essentials: '500-749', savings: '100-249' });
    expect(data.loaves[0].targetCents).toBe(dollars(400));
  });

  it('with transactions: skips the savings answer and re-prices the months', async () => {
    await setup(true);
    const r = await retakePlacement(adapter, { essentials: '500-749', savings: '1000-plus' });
    expect(r.answers.savings).toBe('none');
    expect((await loadProfile(adapter))?.savings).toBe('none');
    expect(r.suggestedTargetCents).toBe(dollars(650));
  });

  it('never deletes or changes transactions or loaves, with or without them', async () => {
    for (const withTransactions of [false, true]) {
      adapter = createMemoryAdapter();
      await setup(withTransactions);
      const before = await adapter.load();
      await retakePlacement(adapter, { essentials: '1000-1499', accounts: ['high-yield-savings'], cardDebt: 'yes' });
      const after = await adapter.load();
      expect(after.transactions).toEqual(before.transactions);
      expect(after.loaves).toEqual(before.loaves);
      expect(after.clock).toEqual(before.clock);
    }
  });

  it('updates account steps and recommendations for the new answers', async () => {
    await setup(true);
    const r = await retakePlacement(adapter, { accounts: ['high-yield-savings'] });
    expect(r).toMatchObject({ needsHysaStep: false, whereToKeepOptional: true });
  });

  it('works from a skipped placement: the $1,000 default becomes 1 month of the new essentials', async () => {
    await savePlacement(adapter, {});
    await startLoaf(adapter, EF, dollars(1000));
    await deposit(adapter, EF, dollars(100));
    const r = await retakePlacement(adapter, { essentials: '250-499' });
    expect(r.suggestedTargetCents).toBe(dollars(400));
    expect(r.profile.placementStatus).toBe('partial');
  });

  it('works when there is no loaf yet', async () => {
    await savePlacement(adapter, {});
    const r = await retakePlacement(adapter, maya);
    expect(r.suggestedTargetCents).toBeNull();
    expect((await loadProfile(adapter))?.placementStatus).toBe('complete');
  });
});
