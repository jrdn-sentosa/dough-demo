import type { DataAdapter } from './adapter';
import { normalizeAppData } from './normalize';
import { emptyData, type AppData } from './types';

export const STORAGE_KEY = 'dough:v1';

/** The slice of the Web Storage API we use, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isAppData(value: unknown): value is AppData {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const clock = v.clock as Record<string, unknown> | null | undefined;
  return (
    v.version === 1 &&
    Array.isArray(v.loaves) &&
    Array.isArray(v.transactions) &&
    typeof clock === 'object' &&
    clock !== null &&
    Number.isInteger(clock.offsetDays)
  );
}

/**
 * localStorage adapter. Browsers can block storage (private mode) or hold
 * damaged data, so every read and write is guarded. When storage can't be
 * written, the latest data is kept in memory for the rest of the session.
 */
export function createLocalAdapter(storage?: StorageLike): DataAdapter {
  let fallback: AppData | null = null;

  function resolveStorage(): StorageLike | null {
    try {
      return storage ?? window.localStorage;
    } catch {
      return null;
    }
  }

  return {
    async load() {
      try {
        const raw = resolveStorage()?.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isAppData(parsed)) return normalizeAppData(parsed);
        }
      } catch {
        // fall through to the in-memory copy or fresh data
      }
      return fallback ?? emptyData();
    },
    async save(data) {
      fallback = data;
      try {
        resolveStorage()?.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch {
        // storage blocked or full: keep going from memory
      }
    },
  };
}
