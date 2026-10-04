import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getSupabase, isSupabaseConfigured } from '../data/supabaseClient';

/** A real account (Supabase). The demo user is not an account: it lives only in this browser's local data. */
export interface Account {
  id: string;
  email: string;
}

interface AuthContextValue {
  /** False until the saved session has been read. Nothing is loaded before that, so no screen flashes. */
  ready: boolean;
  /** Whether real accounts are available at all (Supabase keys are set). */
  configured: boolean;
  account: Account | null;
}

const NOT_CONFIGURED: AuthContextValue = { ready: true, configured: false, account: null };

const AuthContext = createContext<AuthContextValue>(NOT_CONFIGURED);

/**
 * Tells the app who is signed in. A Supabase session means a real account; otherwise the demo user (if any)
 * is read from local data by the data layer. Without Supabase keys it is always "no account".
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [account, setAccount] = useState<Account | null>(null);
  const [ready, setReady] = useState(!configured);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let live = true;
    const toAccount = (user: { id: string; email?: string } | undefined | null): Account | null =>
      user ? { id: user.id, email: user.email ?? '' } : null;

    // Reading the session also finishes a Google sign-in: it swaps the `?code=` in the URL for a session.
    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (live) setAccount(toAccount(data.session?.user));
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setReady(true);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (live) setAccount(toAccount(session?.user));
    });
    return () => {
      live = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ ready, configured, account }), [ready, configured, account]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Without an `AuthProvider` (tests) this says "not configured, no account". */
export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
