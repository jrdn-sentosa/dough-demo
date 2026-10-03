import type { AppData } from './types';

/**
 * Stores and returns raw rows only. Balances, stages, and rules live in
 * `src/money/` and `src/domain/`, so the storage behind this can be swapped
 * (localStorage now, Supabase in milestone 10).
 *
 * `load` never throws: missing or unreadable data returns fresh empty data.
 * `save` never throws: if storage is blocked the app keeps working in memory.
 */
export interface DataAdapter {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
