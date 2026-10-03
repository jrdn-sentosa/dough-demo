import type { DataAdapter } from './adapter';
import { emptyData, type AppData } from './types';

/** In-memory adapter with the same interface as the real ones. Used by tests. */
export function createMemoryAdapter(initial?: AppData): DataAdapter {
  let stored: string | null = initial ? JSON.stringify(initial) : null;
  return {
    async load() {
      return stored === null ? emptyData() : (JSON.parse(stored) as AppData);
    },
    async save(data) {
      // Round-trip through JSON so callers can't mutate stored state by accident.
      stored = JSON.stringify(data);
    },
  };
}
