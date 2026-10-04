import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from './adapter';
import { STORAGE_KEY, createLocalAdapter } from './localAdapter';
import { createMemoryAdapter } from './memoryAdapter';
import { retakePlacement, saveEssentials, savePlacement, saveRisk } from './profile';
import { emptyData } from './types';
import { startLoaf } from '../money/ledger';

let adapter: DataAdapter;

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await savePlacement(adapter, { essentials: '250-499', accounts: ['checking'], cardDebt: 'no', earnedIncome: true });
});

describe('saveRisk', () => {
  it('saves the answers, their status and the result on the profile', async () => {
    const record = await saveRisk(adapter, { horizon: 'over-five', drop: 'wait', priority: 'balance', experience: 'little' });
    expect(record).toMatchObject({
      status: 'complete',
      result: { keepSavings: false, approach: 'growth', loaf: 'index-funds', where: 'roth-ira' },
    });
    expect((await adapter.load()).profile?.risk).toEqual(record);
  });

  it('uses earned income from placement: no income means a regular investment account', async () => {
    await savePlacement(adapter, { essentials: '250-499', cardDebt: 'no', earnedIncome: false });
    const record = await saveRisk(adapter, { horizon: 'over-five' });
    expect(record?.result.where).toBe('investment-account');
  });

  it('never guesses a Roth IRA when earned income is unknown', async () => {
    await savePlacement(adapter, { essentials: '250-499', cardDebt: 'no' });
    expect((await saveRisk(adapter, { horizon: 'over-five' }))?.result.where).toBeNull();
  });

  it('keeps a skipped or partly answered quiz, with the cautious result', async () => {
    expect(await saveRisk(adapter, {})).toMatchObject({ status: 'skipped', result: { approach: 'steady' } });
    expect(await saveRisk(adapter, { horizon: 'within-year' })).toMatchObject({
      status: 'partial',
      answers: { horizon: 'within-year' },
      result: { keepSavings: true },
    });
  });

  it('does nothing without a profile', async () => {
    expect(await saveRisk(createMemoryAdapter(), { horizon: 'over-five' })).toBeNull();
  });

  it('leaves loaves, transactions and the other profile answers alone', async () => {
    await startLoaf(adapter, 'emergency-fund', 40_000);
    const before = await adapter.load();
    await saveRisk(adapter, { horizon: 'over-five' });
    const after = await adapter.load();
    expect({ ...after.profile, risk: null }).toEqual({ ...before.profile, risk: null });
    expect(after.loaves).toEqual(before.loaves);
    expect(after.transactions).toEqual(before.transactions);
  });
});

describe('the risk result survives placement', () => {
  it('is not cleared by saving placement again', async () => {
    const record = await saveRisk(adapter, { horizon: 'over-five', drop: 'wait' });
    await savePlacement(adapter, { essentials: '500-749', cardDebt: 'yes' });
    expect((await adapter.load()).profile?.risk).toEqual(record);
  });

  it('is not cleared by retaking placement, which still updates the answers', async () => {
    const record = await saveRisk(adapter, { horizon: 'over-five', drop: 'wait' });
    await startLoaf(adapter, 'emergency-fund', 40_000);
    const result = await retakePlacement(adapter, { cardDebt: 'yes' });
    expect(result.profile.risk).toEqual(record);
    const profile = (await adapter.load()).profile;
    expect(profile?.risk).toEqual(record);
    expect(profile?.cardDebt).toBe('yes');
  });
});

describe('saveEssentials', () => {
  it('stores a monthly figure for a student whose essentials were unknown', async () => {
    await savePlacement(adapter, { essentials: 'not-sure', cardDebt: 'no' });
    expect((await adapter.load()).profile?.essentialsCents).toBeNull();
    const profile = await saveEssentials(adapter, 80_000);
    expect(profile?.essentialsCents).toBe(80_000);
    expect((await adapter.load()).profile?.essentialsCents).toBe(80_000);
  });

  it('does nothing without a profile', async () => {
    expect(await saveEssentials(createMemoryAdapter(), 80_000)).toBeNull();
  });
});

describe('older saved profiles', () => {
  it('load with no risk result', async () => {
    const data = emptyData();
    data.profile = { ...(await adapter.load()).profile! };
    const old = JSON.parse(JSON.stringify(data)) as { profile: Record<string, unknown> };
    delete old.profile.risk;
    const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify(old)]]);
    const local = createLocalAdapter({ getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) });
    expect((await local.load()).profile?.risk).toBeNull();
  });
});
