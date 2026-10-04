import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { AdapterStatus, DataAdapter } from '../data/adapter';
import { createLocalAdapter } from '../data/localAdapter';
import { createSupabaseAdapter } from '../data/supabaseAdapter';
import { dbFromClient, getSupabase } from '../data/supabaseClient';
import type { AppData } from '../data/types';
import { useAuth } from './AuthProvider';

interface DataContextValue {
  adapter: DataAdapter;
  /** Null until the first load finishes. */
  data: AppData | null;
  /** Reloads from the adapter. Call after anything that writes, so routes see the new state. */
  refresh: () => Promise<AppData>;
  /** Whether the adapter can reach its storage. Always `online` for the demo user. */
  connection: AdapterStatus;
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Loads app data once and shares it. A real account reads and writes Supabase; the demo user (and anyone signed
 * out) uses this browser's local storage. The two never mix: signing in does not import local demo data.
 * Tests pass an in-memory adapter.
 */
export function DataProvider({ adapter: given, children }: { adapter?: DataAdapter; children: ReactNode }) {
  const { ready, account } = useAuth();
  const accountId = account?.id ?? null;

  const adapter = useMemo<DataAdapter>(() => {
    if (given) return given;
    const supabase = getSupabase();
    return accountId && supabase ? createSupabaseAdapter(dbFromClient(supabase)) : createLocalAdapter();
  }, [given, accountId]);

  const [loaded, setLoaded] = useState<{ adapter: DataAdapter; data: AppData } | null>(null);
  const [reported, setReported] = useState<{ adapter: DataAdapter; status: AdapterStatus } | null>(null);
  const connection: AdapterStatus = reported && reported.adapter === adapter ? reported.status : 'online';

  // Data from a different adapter (just signed in or out) is not shown, so nothing from the other store flashes.
  const data = loaded && loaded.adapter === adapter ? loaded.data : null;

  const refresh = useCallback(async () => {
    const next = await adapter.load();
    setLoaded({ adapter, data: next });
    return next;
  }, [adapter]);

  useEffect(() => {
    if (!ready) return;
    let live = true;
    const stop = adapter.onStatus?.((s) => {
      if (live) setReported({ adapter, status: s });
    });
    void adapter.load().then((next) => {
      if (live) setLoaded({ adapter, data: next });
    });
    return () => {
      live = false;
      stop?.();
    };
  }, [adapter, ready]);

  // The browser knows about a dropped connection before any request fails.
  useEffect(() => {
    if (!accountId) return;
    const down = () => setReported({ adapter, status: 'offline' });
    const up = () => void refresh();
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => {
      window.removeEventListener('offline', down);
      window.removeEventListener('online', up);
    };
  }, [accountId, adapter, refresh]);

  return <DataContext.Provider value={{ adapter, data, refresh, connection }}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
