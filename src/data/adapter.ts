import type { AppData } from './types';

/**
 * Whether the adapter can reach its storage. Only the Supabase adapter reports it.
 * - `online`: the last read or write worked.
 * - `offline`: the network is unreachable. Data stays readable, changes are not saved.
 * - `error`: the server refused or failed. Same effect for the student, different message.
 */
export type AdapterStatus = 'online' | 'offline' | 'error';

/**
 * Stores and returns raw rows only. Balances, stages, and rules live in
 * `src/money/` and `src/domain/`, so the storage behind this can be swapped
 * (localStorage for the demo user, Supabase for real accounts).
 *
 * `load` never throws: missing or unreadable data returns fresh empty data.
 * `save` never throws: if storage is blocked the app keeps working in memory.
 */
export interface DataAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
  /**
   * Optional. Called with every change in reachability. Returns an unsubscribe function.
   * Local and in-memory adapters never go offline and leave it out.
   */
  onStatus?(listener: (status: AdapterStatus) => void): () => void;
}
