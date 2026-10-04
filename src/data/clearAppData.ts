import { signOutThisDevice } from './auth';
import { getSupabase } from './supabaseClient';

/** The slice of `localStorage` and `sessionStorage` this needs. */
export interface KeyStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** The slice of the browser this needs, so tests can pass fakes. */
export interface ClearDeps {
  stores: readonly KeyStore[];
  /** The Cache API (service worker caches), or null when the browser has none. */
  caches: { keys(): Promise<string[]>; delete(name: string): Promise<boolean> } | null;
  /** The service worker container, or null when the browser has none. */
  workers: { getRegistrations(): Promise<readonly { unregister(): Promise<boolean> }[]> } | null;
  /** Signs out of an account on this device only. A no-op without an account. */
  signOutThisDevice(): Promise<void>;
}

/**
 * Every key this app keeps in browser storage: `dough:v1` (local demo data), `dough:cache:<user id>` (the offline copy
 * of account data), `dough.demo` (the demo-mode flag), and the sign-in session that Supabase keeps
 * (`sb-<project>-auth-token` and its code verifier). Nothing else is touched.
 */
export const OWN_STORAGE_KEY = /^(dough[:.]|sb-.+-auth-token(-code-verifier)?$)/;

export interface ClearResult {
  ok: boolean;
  /** Which steps could not finish (for example storage blocked by the browser). Empty when ok. */
  failed: ('sign-out' | 'storage' | 'caches' | 'service-worker')[];
  removedKeys: number;
  removedCaches: number;
  unregistered: number;
}

/**
 * Clears everything this device stores for Dough!: the local demo data, the offline copy of account data, the demo
 * flag, the saved sign-in, and the service worker with its caches. It never deletes anything in Supabase: the only
 * call to the server is `signOutThisDevice`, which ends the session on this device (not on the student's other
 * devices). Every step runs even if an earlier one failed, and the result says which did not finish.
 */
export async function clearAppData(deps: ClearDeps): Promise<ClearResult> {
  const result: ClearResult = { ok: true, failed: [], removedKeys: 0, removedCaches: 0, unregistered: 0 };
  const fail = (step: ClearResult['failed'][number]) => {
    result.ok = false;
    result.failed.push(step);
  };

  // First, so the sign-in library removes its own session and the app hears about it before storage is emptied.
  try {
    await deps.signOutThisDevice();
  } catch {
    fail('sign-out');
  }

  try {
    for (const store of deps.stores) {
      const keys: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const key = store.key(i);
        if (key !== null && OWN_STORAGE_KEY.test(key)) keys.push(key);
      }
      for (const key of keys) store.removeItem(key);
      result.removedKeys += keys.length;
    }
  } catch {
    fail('storage');
  }

  if (deps.caches) {
    try {
      const names = await deps.caches.keys();
      const deleted = await Promise.all(names.map((name) => deps.caches!.delete(name)));
      result.removedCaches = deleted.filter(Boolean).length;
    } catch {
      fail('caches');
    }
  }

  if (deps.workers) {
    try {
      const registrations = await deps.workers.getRegistrations();
      const done = await Promise.all(registrations.map((r) => r.unregister()));
      result.unregistered = done.filter(Boolean).length;
    } catch {
      fail('service-worker');
    }
  }

  return result;
}

/** The real browser's pieces. Each is optional: a private window can block storage, and some browsers have no service workers. */
export function deviceDeps(): ClearDeps {
  const stores: KeyStore[] = [];
  for (const get of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      stores.push(get());
    } catch {
      // storage is blocked, so there is nothing of ours in it
    }
  }
  return {
    stores,
    caches: typeof caches === 'undefined' ? null : caches,
    workers: 'serviceWorker' in navigator ? navigator.serviceWorker : null,
    signOutThisDevice: async () => {
      const auth = getSupabase()?.auth;
      if (auth) await signOutThisDevice(auth);
    },
  };
}
