import type { AdapterStatus, DataAdapter } from './adapter';
import { normalizeAppData } from './normalize';
import type { StorageLike } from './localAdapter';
import { KEY_COLUMNS, TABLES, emptyRows, fromRows, rowKey, toRows, type Row, type TableName, type TableRows } from './supabaseMapping';
import { emptyData, type AppData } from './types';

/**
 * The narrow slice of Supabase the adapter uses, so tests can pass an in-memory fake.
 * Every method throws when the request fails. `supabaseDb.ts` builds the real one.
 */
export interface Db {
  /** The signed-in user, read from the saved session (no network). Null when signed out. */
  user(): Promise<{ id: string; email: string } | null>;
  /** All of the signed-in user's rows in a table (Row Level Security limits it to them). */
  select(table: TableName): Promise<Row[]>;
  upsert(table: TableName, rows: Row[]): Promise<void>;
  /** Deletes the rows with these key values (each row has `user_id` plus the table's key columns). */
  remove(table: TableName, keys: Row[]): Promise<void>;
}

export const CACHE_PREFIX = 'dough:cache:';

/** Rows keyed by primary key, each as a string, so "did this row change?" is a string compare. */
type Snapshot = Record<TableName, Map<string, string>>;

function snapshotOf(rows: TableRows): Snapshot {
  const snap = {} as Snapshot;
  for (const table of TABLES) snap[table] = new Map(rows[table].map((r) => [rowKey(table, r), JSON.stringify(r)]));
  return snap;
}

function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const message = e instanceof Error ? e.message : String(e);
  return e instanceof TypeError || /failed to fetch|network|load failed|fetch failed/i.test(message);
}

/**
 * Supabase adapter for real accounts. Same interface as the local adapter, and `src/money/` still derives every balance.
 *
 * - `load` reads every table and remembers what it read. `save` compares the new data with that and
 *   writes only what changed. Writes are idempotent, so a save that failed halfway is repaired by the next one.
 * - Nothing queues. Offline, `save` does not throw and does not pretend to work: the change is not kept, the next
 *   `load` returns the last data that was really saved, and the status listeners hear `offline`.
 * - The last good data is also kept in `localStorage` (`dough:cache:<user id>`, read only) so a reload while
 *   offline still shows the student's loaf. It is cleared by `clearCache` on sign out.
 * - Using two devices at once is "last save wins" for loaf and user_state rows. Transactions are insert-only with
 *   random ids, so deposits are never lost.
 */
export function createSupabaseAdapter(db: Db, storage?: StorageLike): DataAdapter {
  let snapshot: Snapshot | null = null;
  let lastGood: AppData | null = null;
  let status: AdapterStatus = 'online';
  /** True after a read failed and the screen is showing the saved copy (or nothing) instead of the server's rows. */
  let fellBack = false;
  const listeners = new Set<(s: AdapterStatus) => void>();

  function report(next: AdapterStatus) {
    if (next === status) return;
    status = next;
    listeners.forEach((l) => l(next));
  }

  function resolveStorage(): StorageLike | null {
    try {
      return storage ?? window.localStorage;
    } catch {
      return null;
    }
  }

  function readCache(userId: string): AppData | null {
    try {
      const raw = resolveStorage()?.getItem(CACHE_PREFIX + userId);
      if (raw) return normalizeAppData(JSON.parse(raw) as AppData);
    } catch {
      // damaged or blocked: no cache
    }
    return null;
  }

  function writeCache(userId: string, data: AppData) {
    try {
      resolveStorage()?.setItem(CACHE_PREFIX + userId, JSON.stringify(data));
    } catch {
      // blocked or full: the in-memory copy still works
    }
  }

  const copy = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData;

  const adapter: DataAdapter = {
    async load() {
      let user: { id: string; email: string } | null = null;
      try {
        user = await db.user();
        if (!user) return emptyData();
        const rows = emptyRows();
        for (const table of TABLES) rows[table] = await db.select(table);
        const data = normalizeAppData(fromRows(rows, { email: user.email }));
        // Compare against what the app would write for this data, so an unchanged row is never re-sent.
        const written = toRows(data, user.id);
        if (rows.user_state.length === 0) written.user_state = [];
        snapshot = snapshotOf(written);
        lastGood = copy(data);
        writeCache(user.id, data);
        fellBack = false;
        report('online');
        return data;
      } catch (e) {
        fellBack = true;
        report(isNetworkError(e) ? 'offline' : 'error');
        if (lastGood) return copy(lastGood);
        const cached = user ? readCache(user.id) : null;
        if (cached) {
          lastGood = copy(cached);
          return cached;
        }
        // Nothing to show. `snapshot` stays null, so `save` refuses until a read works (see below).
        return user ? { ...emptyData(), user: { email: user.email } } : emptyData();
      }
    },

    async save(data) {
      try {
        // Never write before a successful read: an empty screen from a failed load must not overwrite saved rows.
        // If the data being saved came from a failed read it is a stand-in, not the student's rows, so it is
        // dropped: the read below fixes the snapshot, and the next load shows the real data.
        if (!snapshot) {
          const standIn = fellBack;
          await adapter.load();
          if (standIn) return;
        }
        const user = await db.user();
        if (!user) return;
        if (!snapshot) return;
        const next = toRows(data, user.id);
        const nextSnap = snapshotOf(next);

        for (const table of TABLES) {
          const changed = next[table].filter((r) => snapshot![table].get(rowKey(table, r)) !== JSON.stringify(r));
          if (changed.length) await db.upsert(table, changed);
        }
        for (const table of [...TABLES].reverse()) {
          const gone = [...snapshot[table].keys()].filter((k) => !nextSnap[table].has(k));
          if (!gone.length) continue;
          const cols = KEY_COLUMNS[table];
          const keys = gone.map((k) => {
            const parts = k.split('\u0000');
            const key: Row = { user_id: user.id };
            cols.forEach((c, i) => (key[c] = parts[i]));
            return key;
          });
          await db.remove(table, keys);
        }

        snapshot = nextSnap;
        lastGood = copy(normalizeAppData(copy(data)));
        writeCache(user.id, lastGood);
        report('online');
      } catch (e) {
        report(isNetworkError(e) ? 'offline' : 'error');
      }
    },

    onStatus(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
  return adapter;
}

/** Removes the read-only offline copy. Call on sign out, so the next person on this device sees nothing. */
export function clearCache(userId: string, storage?: StorageLike & { removeItem?(key: string): void }): void {
  try {
    const s = (storage ?? window.localStorage) as StorageLike & { removeItem?(key: string): void };
    s.removeItem?.(CACHE_PREFIX + userId);
  } catch {
    // nothing to clear
  }
}
