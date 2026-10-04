import { describe, expect, it } from 'vitest';
import type { AdapterStatus } from './adapter';
import { createFakeDb } from './fakeDb';
import type { StorageLike } from './localAdapter';
import { CACHE_PREFIX, clearCache, createSupabaseAdapter } from './supabaseAdapter';
import { emptyData, type AppData } from './types';

function fakeStorage(): StorageLike & { map: Map<string, string>; removeItem(k: string): void } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const EF = 'emergency-fund';

function withLoaf(data: AppData): AppData {
  data.loaves.push({ loafId: EF, targetCents: 40_000, startedAt: '2026-01-01T00:00:00.000Z', bread: 'sandwich', bakes: [], growFromCents: null });
  data.transactions.push({ id: 'tx-1', loafId: EF, type: 'starting', source: 'manual', amountCents: 5_000, at: '2026-01-01T00:00:00.000Z' });
  return data;
}

async function setup() {
  const db = createFakeDb();
  const storage = fakeStorage();
  const adapter = createSupabaseAdapter(db, storage);
  const statuses: AdapterStatus[] = [];
  adapter.onStatus?.((s) => statuses.push(s));
  await adapter.save(withLoaf(await adapter.load()));
  db.writes.length = 0;
  return { db, storage, adapter, statuses };
}

describe('supabase adapter writes', () => {
  it('sends only the rows that changed', async () => {
    const { db, adapter } = await setup();
    const data = await adapter.load();
    data.transactions.push({ id: 'new-1', loafId: EF, type: 'deposit', source: 'manual', amountCents: 1_000, at: '2026-01-08T00:00:00.000Z' });
    await adapter.save(data);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ op: 'upsert', table: 'transactions' });
    expect(db.writes[0].rows.map((r) => r.id)).toEqual(['new-1']);
  });

  it('sends nothing when nothing changed', async () => {
    const { db, adapter } = await setup();
    await adapter.save(await adapter.load());
    expect(db.writes).toEqual([]);
  });

  it('writes a loaf before the transactions that point to it', async () => {
    const db = createFakeDb();
    const adapter = createSupabaseAdapter(db, fakeStorage());
    await adapter.save(withLoaf(await adapter.load()));
    expect(db.writes.map((w) => w.table)).toEqual(['loaves', 'transactions', 'user_state']);
  });

  it('stamps every row with the signed-in user, whatever the data says', async () => {
    const { db, adapter } = await setup();
    const data = await adapter.load();
    data.user = { email: 'someone-else@example.com' };
    data.habit = { kind: 'weekly', amountCents: 500, paycheckCents: null, frequency: null, startedAt: '2026-01-01T00:00:00.000Z' };
    await adapter.save(data);
    const all = Object.values(db.tables).flat();
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((r) => r.user_id === 'user-1')).toBe(true);
  });

  it('only reads the signed-in user, so another account sees nothing', async () => {
    const { db } = await setup();
    db.signedInAs = { id: 'user-2', email: 'other@example.com' };
    const other = await createSupabaseAdapter(db, fakeStorage()).load();
    expect(other.loaves).toEqual([]);
    expect(other.transactions).toEqual([]);
    expect(other.user).toEqual({ email: 'other@example.com' });
  });

  it('deletes rows that are gone', async () => {
    const { db, adapter } = await setup();
    const data = await adapter.load();
    data.hysaCard = 'pending';
    data.lessonProgress.push({ loafId: EF, lessonId: 'l1', watchedAt: '2026-01-02T00:00:00.000Z', how: 'manual' });
    await adapter.save(data);
    const again = await adapter.load();
    again.lessonProgress = [];
    await adapter.save(again);
    expect(db.tables.lesson_progress).toEqual([]);
  });

  it('is not signed in: reads and writes nothing', async () => {
    const db = createFakeDb(null);
    const adapter = createSupabaseAdapter(db, fakeStorage());
    expect(await adapter.load()).toEqual(emptyData());
    await adapter.save(withLoaf(emptyData()));
    expect(db.writes).toEqual([]);
  });
});

describe('supabase adapter when a save fails halfway', () => {
  it('sends the rest on the next save', async () => {
    const { db, adapter, statuses } = await setup();
    const data = await adapter.load();
    data.habit = { kind: 'weekly', amountCents: 500, paycheckCents: null, frequency: null, startedAt: '2026-01-01T00:00:00.000Z' };
    data.transactions.push({ id: 'new-1', loafId: EF, type: 'deposit', source: 'manual', amountCents: 1_000, at: '2026-01-08T00:00:00.000Z' });
    db.failWriteNumber = 2; // the transaction goes through, the habit (user_state) fails
    await adapter.save(data);
    expect(statuses.at(-1)).toBe('error');
    expect(db.tables.transactions).toHaveLength(2);
    expect(db.tables.user_state[0].habit).toBeNull();

    await adapter.save(data);
    expect(db.tables.user_state[0].habit).toMatchObject({ amountCents: 500 });
    expect(db.tables.transactions).toHaveLength(2); // the same id is not added twice
    expect(statuses.at(-1)).toBe('online');
  });
});

describe('supabase adapter offline', () => {
  it('does not throw, keeps the last saved data readable, and reports it', async () => {
    const { db, adapter, statuses } = await setup();
    const before = await adapter.load();
    db.offline = true;

    const data = await adapter.load();
    expect(data).toEqual(before);
    expect(statuses.at(-1)).toBe('offline');

    data.transactions.push({ id: 'new-1', loafId: EF, type: 'deposit', source: 'manual', amountCents: 1_000, at: '2026-01-08T00:00:00.000Z' });
    await expect(adapter.save(data)).resolves.toBeUndefined();
    expect(await adapter.load()).toEqual(before); // the unsaved deposit is not shown as saved
    expect(db.tables.transactions).toHaveLength(1);
  });

  it('recovers when the connection comes back, with no queued changes', async () => {
    const { db, adapter, statuses } = await setup();
    db.offline = true;
    const data = await adapter.load();
    data.hysaCard = 'pending';
    await adapter.save(data);
    db.offline = false;
    expect((await adapter.load()).hysaCard).toBeNull();
    expect(statuses.at(-1)).toBe('online');
  });

  it('shows the last copy after a reload while offline', async () => {
    const { db, storage } = await setup();
    const loaded = await createSupabaseAdapter(db, storage).load();
    expect(storage.map.has(CACHE_PREFIX + 'user-1')).toBe(true);

    db.offline = true;
    const reloaded = await createSupabaseAdapter(db, storage).load();
    expect(reloaded).toEqual(loaded);
  });

  it('never overwrites saved rows with an empty screen after a failed first read', async () => {
    const { db } = await setup();
    const fresh = createSupabaseAdapter(db, fakeStorage()); // no memory, no cache
    db.offline = true;
    const empty = await fresh.load();
    expect(empty.loaves).toEqual([]);

    db.offline = false;
    empty.habit = { kind: 'weekly', amountCents: 500, paycheckCents: null, frequency: null, startedAt: '2026-01-01T00:00:00.000Z' };
    await fresh.save(empty); // the stand-in is dropped, never diffed against the real rows
    expect(db.tables.loaves).toHaveLength(1);
    expect(db.tables.transactions).toHaveLength(1);
    expect(db.writes).toEqual([]);
    expect((await fresh.load()).transactions).toHaveLength(1);
  });

  it('clears the offline copy on sign out', async () => {
    const { storage } = await setup();
    expect(storage.map.has(CACHE_PREFIX + 'user-1')).toBe(true);
    clearCache('user-1', storage);
    expect(storage.map.has(CACHE_PREFIX + 'user-1')).toBe(false);
  });
});
