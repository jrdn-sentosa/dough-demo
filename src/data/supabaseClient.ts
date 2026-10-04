import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Db } from './supabaseAdapter';
import { KEY_COLUMNS, type Row } from './supabaseMapping';

/**
 * The app only ever uses the project URL and the publishable key (`sb_publishable_...`). Both are safe in the
 * browser because Row Level Security decides what a signed-in user can touch. Secret keys never go in the app.
 */
export function supabaseEnv(): { url: string; key: string } | null {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** The one switch for "are real accounts available?". False in tests and on a fresh clone with no `.env.local`. */
export function isSupabaseConfigured(): boolean {
  return supabaseEnv() !== null;
}

let client: SupabaseClient | null | undefined;

/** One shared client, or null when Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const env = supabaseEnv();
  client = env ? createClient(env.url, env.key, { auth: { flowType: 'pkce' } }) : null;
  return client;
}

/** The real `Db` for the adapter. Reads the user from the saved session, so it works with no network. */
export function dbFromClient(supabase: SupabaseClient): Db {
  return {
    async user() {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? '' } : null;
    },
    async select(table) {
      const { data, error } = await supabase.from(table).select('*');
      if (error) throw new Error(error.message);
      return (data ?? []) as Row[];
    },
    async upsert(table, rows) {
      const { error } = await supabase.from(table).upsert(rows);
      if (error) throw new Error(error.message);
    },
    async remove(table, keys) {
      for (const key of keys) {
        let query = supabase.from(table).delete().eq('user_id', key.user_id as string);
        for (const col of KEY_COLUMNS[table]) query = query.eq(col, key[col] as string);
        const { error } = await query;
        if (error) throw new Error(error.message);
      }
    },
  };
}
