import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../../app/AuthProvider';
import type { Account } from '../../app/AuthProvider';
import { useData } from '../../app/DataProvider';
import { canChooseNext } from '../../app/guard';
import { DemoActions } from '../../components/DemoActions';
import { SliceButton } from '../../components/SliceButton';
import { isDemoMode } from '../../app/demoFlag';
import { signOutAccount } from '../../data/auth';
import { signOutLocal } from '../../data/session';
import { clearCache } from '../../data/supabaseAdapter';
import { feedbackSender, getSupabase } from '../../data/supabaseClient';
import { DraftNote } from '../../components/DraftNote';
import { PreviewAbout } from '../../components/PreviewAbout';
import { getPreview, getSettings } from '../../content/loader';
import { DISCLAIMER_LINES } from '../Login';
import { DailyQuizSection } from './DailyQuizSection';
import { GoalSection } from './GoalSection';
import { ClearDataSection } from './ClearDataSection';
import type { ClearActions } from './ClearDataSection';
import { FeedbackSection } from './FeedbackSection';
import type { FeedbackSender } from './FeedbackSection';
import { HabitSection } from './HabitSection';

export const RETAKE_PATH = `/placement?retake=1&return=${encodeURIComponent('/settings')}`;

/**
 * A bare Settings screen: who is signed in, sign out for real accounts, "Exit demo" for the demo user (it keeps the local
 * demo data, so "Continue as demo user" picks up where they left off),
 * retaking the placement quiz, changing the goal and the saving habit, the demo tools (`?demo=1`, demo user only), and the disclaimer.
 */
export function Settings() {
  const { account } = useAuth();
  async function signOut(current: Account) {
    const auth = getSupabase()?.auth;
    if (auth) await signOutAccount(auth);
    clearCache(current.id);
  }
  return <SettingsView account={account} onSignOut={signOut} sendFeedback={sendToSupabase} />;
}

/** Feedback goes to the `feedback` table with the signed-in session. Without Supabase there is nothing to send to. */
const sendToSupabase: FeedbackSender = async (row) => {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Feedback needs an account');
  await feedbackSender(supabase)(row);
};

/** Exported so tests can pass an account, a fake sign-out and a fake feedback sender. */
export function SettingsView({
  account,
  onSignOut,
  sendFeedback = sendToSupabase,
  clearActions,
}: {
  account: Account | null;
  onSignOut: (account: Account) => Promise<void>;
  sendFeedback?: FeedbackSender;
  /** Tests pass fakes for clearing the device and reloading. */
  clearActions?: ClearActions;
}) {
  const { adapter, data, refresh } = useData();
  const [busy, setBusy] = useState(false);
  const { hash } = useLocation();

  // "Send feedback" on the welcome notice arrives here with #settings-feedback.
  useEffect(() => {
    if (!data || !hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.();
  }, [data, hash]);

  if (!data) return null;

  async function signOut() {
    if (!account) return;
    setBusy(true);
    await onSignOut(account);
    // The sign-in listener sees the session end and the route guard moves on to the login screen.
    setBusy(false);
  }

  async function exitDemo() {
    await signOutLocal(adapter);
    await refresh();
  }

  return (
    <div className="settings">
      <div className="settings__top">
        <Link className="home__shelf-link" to="/">
          Back to my loaf
        </Link>
      </div>
      <h1 className="screen-title">Settings</h1>
      <DraftNote draft={getSettings().draft} />

      <GoalSection />
      <HabitSection />

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

      {!account && data.user && (
        <section className="settings__section" aria-labelledby="settings-demo">
          <h2 id="settings-demo" className="settings__heading">
            Demo
          </h2>
          <p className="settings__text">You're using the demo on this device. Your demo loaf is kept for when you come back.</p>
          <SliceButton onClick={() => void exitDemo()}>Exit demo</SliceButton>
        </section>
      )}

      {!account && data.user && isDemoMode() && (
        <section className="settings__section">
          <DemoActions actions={['reset', 'fresh']} />
        </section>
      )}

      {isDemoMode() && <ClearDataSection account={account} actions={clearActions} />}

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

      {canChooseNext(data) && (
        <section className="settings__section" aria-labelledby="settings-risk">
          <h2 id="settings-risk" className="settings__heading">
            {getSettings().risk.title}
          </h2>
          <p className="settings__text">{getSettings().risk.intro}</p>
          <Link className="slice-button" to="/risk-quiz">
            {getSettings().risk.link}
          </Link>
        </section>
      )}

      <DailyQuizSection />

      <FeedbackSection account={account} send={sendFeedback} />

      <section className="settings__section" aria-labelledby="settings-preview">
        <h2 id="settings-preview" className="settings__heading">
          {getPreview().about.settingsTitle}
        </h2>
        <PreviewAbout />
      </section>

      <section className="settings__section" aria-labelledby="settings-privacy">
        <h2 id="settings-privacy" className="settings__heading">
          {getPreview().privacy.title}
        </h2>
        <p className="settings__text">{getPreview().privacy.body}</p>
      </section>

      <p className="login__disclaimer">
        {DISCLAIMER_LINES[0]}
        <br />
        {DISCLAIMER_LINES[1]}
      </p>
    </div>
  );
}
