import type { DataAdapter } from './adapter';
import type { LocalUser } from './types';

/**
 * "Continue as demo user". The demo user has no account: it lives only in this browser's local data, works
 * without Supabase or a connection, and nothing leaves the device. `signInAsMaya` (src/money/demo.ts) is what the login
 * button uses; this plain sign-in is the building block. Real accounts sign in through Supabase (`auth.ts`).
 */
export const DEMO_EMAIL = 'demo@dough.local';

export async function signInDemo(adapter: DataAdapter): Promise<LocalUser> {
  const data = await adapter.load();
  data.user = { email: DEMO_EMAIL };
  await adapter.save(data);
  return data.user;
}

export async function signOutLocal(adapter: DataAdapter): Promise<void> {
  const data = await adapter.load();
  data.user = null;
  await adapter.save(data);
}

export async function currentUser(adapter: DataAdapter): Promise<LocalUser | null> {
  return (await adapter.load()).user;
}
