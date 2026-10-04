import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { DataAdapter } from '../data/adapter';
import { createLocalAdapter } from '../data/localAdapter';
import type { AppData } from '../data/types';

interface DataContextValue {
  adapter: DataAdapter;
  /** Null until the first load finishes. */
  data: AppData | null;
  /** Reloads from the adapter. Call after anything that writes, so routes see the new state. */
  refresh: () => Promise<AppData>;
}

const DataContext = createContext<DataContextValue | null>(null);

/** Loads app data once and shares it. Tests pass an in-memory adapter. */
export function DataProvider({ adapter: given, children }: { adapter?: DataAdapter; children: ReactNode }) {
  const [adapter] = useState(() => given ?? createLocalAdapter());
  const [data, setData] = useState<AppData | null>(null);

  const refresh = useCallback(async () => {
    const next = await adapter.load();
    setData(next);
    return next;
  }, [adapter]);

  useEffect(() => {
    let live = true;
    void adapter.load().then((loaded) => {
      if (live) setData(loaded);
    });
    return () => {
      live = false;
    };
  }, [adapter]);

  return <DataContext.Provider value={{ adapter, data, refresh }}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
