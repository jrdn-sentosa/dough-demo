import { describe, expect, it } from 'vitest';
import type { DataAdapter } from './adapter';
import { STORAGE_KEY, createLocalAdapter, type StorageLike } from './localAdapter';
import { createMemoryAdapter } from './memoryAdapter';
import { emptyData } from './types';

function fakeStorage(initial: Record<string, string> = {}): StorageLike & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const throwingStorage: StorageLike = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

function contract(name: string, make: () => DataAdapter) {
  describe(`${name} adapter contract`, () => {
    it('starts fresh when nothing is saved', async () => {
      expect(await make().load()).toEqual(emptyData());
    });

    it('returns what was saved', async () => {
      const adapter = make();
      const data = emptyData();
      data.clock.offsetDays = 7;
      data.transactions.push({
        id: 'tx-1',
        loafId: 'emergency-fund',
        type: 'deposit',
        source: 'manual',
        amountCents: 500,
        at: '2026-01-01T00:00:00.000Z',
      });
      await adapter.save(data);
      expect(await adapter.load()).toEqual(data);
    });

    it('does not let callers change stored data without saving', async () => {
      const adapter = make();
      await adapter.save(emptyData());
      const loaded = await adapter.load();
      loaded.clock.offsetDays = 99;
      expect((await adapter.load()).clock.offsetDays).toBe(0);
    });
  });
}

contract('memory', () => createMemoryAdapter());
contract('local', () => createLocalAdapter(fakeStorage()));

describe('local adapter safety', () => {
  it('uses the single versioned key', async () => {
    const storage = fakeStorage();
    await createLocalAdapter(storage).save(emptyData());
    expect([...storage.map.keys()]).toEqual(['dough:v1']);
    expect(STORAGE_KEY).toBe('dough:v1');
  });

  it.each([
    ['not JSON', '{oops'],
    ['the wrong shape', '{"version":1}'],
    ['a different version', JSON.stringify({ ...emptyData(), version: 2 })],
    ['null', 'null'],
    ['a bad clock', JSON.stringify({ ...emptyData(), clock: { offsetDays: 'x' } })],
  ])('starts fresh when saved data is %s', async (_label, raw) => {
    const adapter = createLocalAdapter(fakeStorage({ [STORAGE_KEY]: raw }));
    expect(await adapter.load()).toEqual(emptyData());
  });

  it('keeps each source and treats rows saved without one as manual', async () => {
    const row = { id: 'tx-1', loafId: 'emergency-fund', type: 'deposit', amountCents: 500, at: '2026-01-01T00:00:00.000Z' };
    const raw = JSON.stringify({
      ...emptyData(),
      transactions: [
        row,
        { ...row, id: 'tx-2', source: 'plaid' },
        { ...row, id: 'tx-3', source: 'seed' },
        { ...row, id: 'tx-4', source: 'bogus' },
      ],
    });
    const loaded = await createLocalAdapter(fakeStorage({ [STORAGE_KEY]: raw })).load();
    expect(loaded.transactions.map((t) => t.source)).toEqual(['manual', 'plaid', 'seed', 'manual']);
  });

  describe('loaves saved before bakes existed', () => {
    const old = { loafId: 'emergency-fund', targetCents: 40_000, startedAt: '2026-01-01T00:00:00.000Z' };
    const load = (loaves: unknown[]) =>
      createLocalAdapter(fakeStorage({ [STORAGE_KEY]: JSON.stringify({ ...emptyData(), loaves }) })).load();

    it('turns firstBakedAt into one dated bake', async () => {
      const { loaves } = await load([{ ...old, firstBakedAt: '2026-02-01T00:00:00.000Z', bakedAtStart: false }]);
      expect(loaves[0].bakes).toEqual([{ targetCents: 40_000, at: '2026-02-01T00:00:00.000Z', bread: 'sandwich' }]);
      expect(loaves[0].growFromCents).toBeNull();
      expect(loaves[0]).not.toHaveProperty('firstBakedAt');
      expect(loaves[0]).not.toHaveProperty('bakedAtStart');
    });

    it('turns bakedAtStart into one "Already built" bake', async () => {
      const { loaves } = await load([{ ...old, firstBakedAt: null, bakedAtStart: true }]);
      expect(loaves[0].bakes).toEqual([{ targetCents: 40_000, at: null, bread: 'sandwich' }]);
    });

    it('gives an unbaked loaf no bakes', async () => {
      const { loaves } = await load([{ ...old, firstBakedAt: null, bakedAtStart: false }]);
      expect(loaves[0].bakes).toEqual([]);
    });

    it('keeps bakes and growFromCents that are already saved', async () => {
      const bakes = [{ targetCents: 40_000, at: null, bread: 'sandwich' }];
      const { loaves } = await load([{ ...old, bakes, growFromCents: 40_000 }]);
      expect(loaves[0]).toMatchObject({ bakes, growFromCents: 40_000 });
    });
  });

  it('does not crash when storage is blocked, and keeps data in memory', async () => {
    const adapter = createLocalAdapter(throwingStorage);
    expect(await adapter.load()).toEqual(emptyData());
    const data = emptyData();
    data.clock.offsetDays = 3;
    await expect(adapter.save(data)).resolves.toBeUndefined();
    expect((await adapter.load()).clock.offsetDays).toBe(3);
  });
});
