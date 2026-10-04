import { useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import type { Account } from '../../app/AuthProvider';
import { useData } from '../../app/DataProvider';
import { SliceButton } from '../../components/SliceButton';
import { signOutAccount } from '../../data/auth';
import { clearCache } from '../../data/supabaseAdapter';
import { getSupabase } from '../../data/supabaseClient';
import { DISCLAIMER_LINES } from '../Login';

export const RETAKE_PATH = `/placement?retake=1&return=${encodeURIComponent('/settings')}`;

/**
 * A bare Settings screen: who is signed in, sign out (real accounts only, since the demo user has no account),
 * retaking the placement quiz, and the disclaimer. Goal and habit changes, demo tools and Reset demo come with milestone 11.
 */
export function Settings() {
  const { account } = useAuth();
  async function signOut(current: Account) {
    const auth = getSupabase()?.auth;
    if (auth) await signOutAccount(auth);
    clearCache(current.id);
  }
  return <SettingsView account={account} onSignOut={signOut} />;
}

/** Exported so tests can pass an account and a fake sign-out. */
export function SettingsView({ account, onSignOut }: { account: Account | null; onSignOut: (account: Account) => Promise<void> }) {
  const { data } = useData();
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  async function signOut() {
    if (!account) return;
    setBusy(true);
    await onSignOut(account);
    // The sign-in listener sees the session end and the route guard moves on to the login screen.
    setBusy(false);
  }

  return (
    <div className="settings">
      <div className="settings__top">
        <Link className="home__shelf-link" to="/">
          Back to my loaf
        </Link>
      </div>
      <h1 className="screen-title">Settings</h1>

      {account && (
        <section className="settings__section" aria-labelledby="settings-account">
          <h2 id="settings-account" className="settings__heading">
            Your account
          </h2>
          <p className="settings__text">
            Signed in as <strong>{account.email}</strong>
          </p>
          <SliceButton onClick={() => void signOut()} disabled={busy}>
            Sign out
          </SliceButton>
        </section>
      )}

      {data.profile && (
        <section className="settings__section" aria-labelledby="settings-placement">
          <h2 id="settings-placement" className="settings__heading">
            Your answers
          </h2>
          <p className="settings__text">Your situation changed? Retake the quiz. It never changes your savings history.</p>
          <Link className="slice-button" to={RETAKE_PATH}>
            Retake the quiz
          </Link>
        </section>
      )}

      <p className="login__disclaimer">
        {DISCLAIMER_LINES[0]}
        <br />
        {DISCLAIMER_LINES[1]}
      </p>
    </div>
  );
}
