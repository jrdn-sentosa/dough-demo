import { describe, expect, it, vi } from 'vitest';
import { signOutThisDevice } from './auth';
import { OWN_STORAGE_KEY, clearAppData, type ClearDeps, type KeyStore } from './clearAppData';

/** A tiny in-memory Storage, with keys in insertion order. */
function fakeStore(initial: Record<string, string>): KeyStore & { keys(): string[]; removeItem: (k: string) => void } {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    keys: () => [...map.keys()],
  };
}

function fakeDeps(over: Partial<ClearDeps> = {}) {
  const local = fakeStore({
    'dough:v1': '{"demo":"data"}',
    'dough:cache:user-1': '{"offline":"copy"}',
    'sb-abcdefgh-auth-token': '{"session":"x"}',
    'sb-abcdefgh-auth-token-code-verifier': 'verifier',
    'someone-elses-key': 'keep me',
    theme: 'dark',
  });
  const session = fakeStore({ 'dough.demo': '1', 'other-session-key': 'keep me' });
  const cacheNames = ['workbox-precache-v2-https://dough.example/', 'dough-fonts', 'dough-videos'];
  const cachesDeleted: string[] = [];
  const unregister = vi.fn().mockResolvedValue(true);
  const signOut = vi.fn().mockResolvedValue(undefined);
  const deps: ClearDeps = {
    stores: [local, session],
    caches: {
      keys: async () => cacheNames,
      delete: async (name) => {
        cachesDeleted.push(name);
        return true;
      },
    },
    workers: { getRegistrations: async () => [{ unregister }, { unregister }] },
    signOutThisDevice: signOut,
    ...over,
  };
  return { deps, local, session, cacheNames, cachesDeleted, unregister, signOut };
}

describe('clearAppData', () => {
  it('clears local demo data, the offline copy, the demo flag, the saved sign-in, every cache and every service worker', async () => {
    const { deps, local, session, cacheNames, cachesDeleted, unregister } = fakeDeps();
    const result = await clearAppData(deps);

    expect(result).toEqual({ ok: true, failed: [], removedKeys: 5, removedCaches: 3, unregistered: 2 });
    expect(local.keys()).not.toContain('dough:v1');
    expect(local.keys()).not.toContain('dough:cache:user-1');
    expect(local.keys().filter((k) => k.startsWith('sb-'))).toEqual([]);
    expect(session.keys()).not.toContain('dough.demo');
    expect(cachesDeleted.sort()).toEqual([...cacheNames].sort());
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('leaves storage that is not Dough!\'s alone', async () => {
    const { deps, local, session } = fakeDeps();
    await clearAppData(deps);
    expect(local.keys().sort()).toEqual(['someone-elses-key', 'theme']);
    expect(session.keys()).toEqual(['other-session-key']);
  });

  it('signs out on this device only, before it clears storage, and makes no other server call', async () => {
    const order: string[] = [];
    const { deps, local } = fakeDeps({
      signOutThisDevice: async () => {
        order.push(`sign out (storage still has ${local.keys().length} keys)`);
      },
    });
    await clearAppData(deps);
    expect(order).toEqual(['sign out (storage still has 6 keys)']);
    // The only thing the deps can reach on the server is that one call: there is no database in ClearDeps.
    expect(Object.keys(deps).sort()).toEqual(['caches', 'signOutThisDevice', 'stores', 'workers']);
  });

  it('still clears everything else when the sign-out fails (for example offline), and says so', async () => {
    const { deps, local, cachesDeleted, unregister } = fakeDeps({ signOutThisDevice: async () => Promise.reject(new Error('offline')) });
    const result = await clearAppData(deps);
    expect(result.ok).toBe(false);
    expect(result.failed).toEqual(['sign-out']);
    expect(local.keys().filter((k) => OWN_STORAGE_KEY.test(k))).toEqual([]);
    expect(cachesDeleted).toHaveLength(3);
    expect(unregister).toHaveBeenCalled();
  });

  it('reports a step that could not finish and still runs the rest', async () => {
    const blocked: KeyStore = {
      length: 1,
      key: () => 'dough:v1',
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    const { deps, cachesDeleted, unregister } = fakeDeps({ stores: [blocked] });
    const result = await clearAppData(deps);
    expect(result.failed).toEqual(['storage']);
    expect(cachesDeleted).toHaveLength(3);
    expect(unregister).toHaveBeenCalledTimes(2);
  });

  it('works in a browser with no Cache API and no service workers', async () => {
    const { deps } = fakeDeps({ caches: null, workers: null });
    expect(await clearAppData(deps)).toMatchObject({ ok: true, removedCaches: 0, unregistered: 0 });
  });

  it('works when nothing is saved at all', async () => {
    const deps: ClearDeps = {
      stores: [fakeStore({})],
      caches: { keys: async () => [], delete: async () => false },
      workers: { getRegistrations: async () => [] },
      signOutThisDevice: async () => undefined,
    };
    expect(await clearAppData(deps)).toEqual({ ok: true, failed: [], removedKeys: 0, removedCaches: 0, unregistered: 0 });
  });
});

describe('which storage keys are Dough!\'s', () => {
  it.each(['dough:v1', 'dough:cache:3f0c', 'dough.demo', 'sb-abcdefgh-auth-token', 'sb-abcdefgh-auth-token-code-verifier'])(
    'includes %s',
    (key) => expect(OWN_STORAGE_KEY.test(key)).toBe(true),
  );
  it.each(['doughnut', 'theme', 'sb-abcdefgh-something-else', 'my-dough:v1', 'token'])('leaves %s', (key) =>
    expect(OWN_STORAGE_KEY.test(key)).toBe(false),
  );
});

describe('signOutThisDevice', () => {
  it('asks Supabase to end only the session on this device', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await signOutThisDevice({ signOut } as never);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('reports a failure to the caller', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: new Error('offline') });
    await expect(signOutThisDevice({ signOut } as never)).rejects.toThrow('offline');
  });
});
