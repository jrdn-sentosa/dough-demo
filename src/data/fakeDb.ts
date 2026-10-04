import type { Db } from './supabaseAdapter';
import { KEY_COLUMNS, TABLES, rowKey, type Row, type TableName } from './supabaseMapping';

/** Test helper: an in-memory stand-in for Supabase, shared by the adapter tests. Not imported by the app. */
export interface FakeDb extends Db {
  /** Everything stored, by table. */
  tables: Record<TableName, Row[]>;
  /** Every write call, in order, so tests can check what was (not) sent. */
  writes: { op: 'upsert' | 'remove'; table: TableName; rows: Row[] }[];
  /** When set, every call throws as a dropped connection would. */
  offline: boolean;
  /** Throws on the n-th write call from now (1 = the next write). For partial-failure tests. */
  failWriteNumber: number | null;
  /** Who is signed in. */
  signedInAs: { id: string; email: string } | null;
}

const TIMESTAMPS = new Set(['at', 'started_at', 'watched_at']);

/** Postgres hands timestamptz back as "2026-01-01T00:00:00+00:00", not as the app wrote it. */
function asPostgres(row: Row): Row {
  const out: Row = { ...row };
  for (const [k, v] of Object.entries(out)) {
    if (TIMESTAMPS.has(k) && typeof v === 'string') out[k] = v.replace('.000Z', '+00:00').replace('Z', '+00:00');
  }
  return out;
}

export function createFakeDb(user: { id: string; email: string } | null = { id: 'user-1', email: 'student@example.com' }): FakeDb {
  const tables = Object.fromEntries(TABLES.map((t) => [t, [] as Row[]])) as Record<TableName, Row[]>;
  const db: FakeDb = {
    tables,
    writes: [],
    offline: false,
    failWriteNumber: null,
    signedInAs: user,

    async user() {
      return db.signedInAs;
    },
    async select(table) {
      if (db.offline) throw new TypeError('Failed to fetch');
      // Row Level Security: only the signed-in user's rows, in no particular order.
      return tables[table].filter((r) => r.user_id === db.signedInAs?.id).map(asPostgres).reverse();
    },
    async upsert(table, rows) {
      if (db.offline) throw new TypeError('Failed to fetch');
      if (db.failWriteNumber !== null && --db.failWriteNumber === 0) throw new Error('write failed');
      db.writes.push({ op: 'upsert', table, rows });
      for (const row of rows) {
        // Row Level Security: a write for another user's row is refused.
        if (row.user_id !== db.signedInAs?.id) throw new Error('new row violates row-level security policy');
        const key = rowKey(table, row);
        const i = tables[table].findIndex((r) => r.user_id === row.user_id && rowKey(table, r) === key);
        const stored = JSON.parse(JSON.stringify(row)) as Row;
        if (i >= 0) tables[table][i] = stored;
        else tables[table].push(stored);
      }
    },
    async remove(table, keys) {
      if (db.offline) throw new TypeError('Failed to fetch');
      if (db.failWriteNumber !== null && --db.failWriteNumber === 0) throw new Error('write failed');
      db.writes.push({ op: 'remove', table, rows: keys });
      for (const key of keys) {
        tables[table] = tables[table].filter(
          (r) => !(r.user_id === key.user_id && KEY_COLUMNS[table].every((c) => String(r[c]) === String(key[c]))),
        );
      }
    },
  };
  return db;
}
