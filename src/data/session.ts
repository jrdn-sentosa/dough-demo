import type { DataAdapter } from './adapter';
import type { LocalUser } from './types';

/**
 * LOCAL-ONLY fake sign-in for the demo. There is no password and nothing
 * leaves this device. Replaced by Supabase auth in milestone 10.
 */
export async function signInLocal(adapter: DataAdapter, email: string): Promise<LocalUser | null> {
  const trimmed = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(trimmed)) return null;
  const data = await adapter.load();
  data.user = { email: trimmed };
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
