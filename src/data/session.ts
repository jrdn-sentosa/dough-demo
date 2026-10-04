import type { DataAdapter } from './adapter';
import type { LocalUser } from './types';

/**
 * "Continue as demo user". The demo user has no account: it lives only in this browser's local data, works
 * without Supabase or a connection, and nothing leaves the device. Until Maya's seed exists (milestone 11)
 * this is a plain demo user who starts placement. Real accounts sign in through Supabase (`auth.ts`).
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
