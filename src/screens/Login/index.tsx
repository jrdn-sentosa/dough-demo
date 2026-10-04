import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { useAuth } from '../../app/AuthProvider';
import { useData } from '../../app/DataProvider';
import { CODE_LENGTH, sendEmailCode, signInWithGoogle, verifyEmailCode } from '../../data/auth';
import type { AuthClient } from '../../data/auth';
import { isDemoMode } from '../../app/demoFlag';
import { DemoActions } from '../../components/DemoActions';
import { signInAsMaya } from '../../money/demo';
import { getPreview } from '../../content/loader';
import { getSupabase } from '../../data/supabaseClient';

export const DISCLAIMER_LINES = ['Educational demo. Not financial advice.', 'No real money moves.'] as const;

const RESEND_SECONDS = 60;

/** Google's four-color "G", from Google's sign-in branding assets. */
function GoogleG() {
  return (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/**
 * Sign in. Real accounts use Supabase: a 6-digit code emailed to the student, or Google. The email form and the
 * Google button are not rendered at all unless Supabase is configured, rather than showing buttons that do nothing.
 * The Google button also needs `VITE_GOOGLE_SIGNIN=true`, set once Google is enabled in Supabase.
 * "Continue as demo user" is always there and stays on this device (no account, no connection needed).
 * Once someone is signed in, the route guard moves them on.
 */
export function Login() {
  const { configured } = useAuth();
  return <LoginView auth={configured ? (getSupabase()?.auth ?? null) : null} google={import.meta.env.VITE_GOOGLE_SIGNIN === 'true'} />;
}

/** `auth` is null when real accounts are not available; `google` turns on the Google button. Exported so tests can pass a fake. */
export function LoginView({ auth, google = false }: { auth: AuthClient | null; google?: boolean }) {
  const { adapter, refresh } = useData();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((w) => w - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function send() {
    if (!auth) return;
    setBusy(true);
    const result = await sendEmailCode(auth, email);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    setCode('');
    setWait(RESEND_SECONDS);
    setStep('code');
  }

  async function onEmail(e: FormEvent) {
    e.preventDefault();
    await send();
  }

  async function onCode(e: FormEvent) {
    e.preventDefault();
    if (!auth) return;
    setBusy(true);
    const result = await verifyEmailCode(auth, email, code);
    setBusy(false);
    // On success Supabase starts the session and the app moves on by itself.
    setError(result.ok ? null : result.message);
  }

  async function onGoogle() {
    if (!auth) return;
    const result = await signInWithGoogle(auth, window.location.origin);
    if (!result.ok) setError(result.message);
  }

  async function onDemo() {
    await signInAsMaya(adapter);
    await refresh();
  }

  return (
    <div className="login">
      <div className="login__brand">
        <svg aria-hidden="true" width="150" height="94" viewBox="0 0 160 100" fill="none">
          <path d="M58 18 C54 12 62 8 58 2" stroke="#C9B497" strokeWidth="3" strokeLinecap="round" />
          <path d="M80 16 C76 10 84 6 80 0" stroke="#C9B497" strokeWidth="3" strokeLinecap="round" />
          <path d="M102 18 C98 12 106 8 102 2" stroke="#C9B497" strokeWidth="3" strokeLinecap="round" />
          <path
            d="M14 80 C14 44 46 28 80 28 C114 28 146 44 146 80 Q146 88 138 88 L22 88 Q14 88 14 80 Z"
            fill="#F6C453"
            stroke="#8A4B1F"
            strokeWidth="3.5"
          />
          <path d="M46 52 Q55 43 65 45" stroke="#8A4B1F" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M72 44 Q81 35 91 37" stroke="#8A4B1F" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M98 50 Q107 41 117 43" stroke="#8A4B1F" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M6 95 L154 95" stroke="#EADBC4" strokeWidth="3" strokeLinecap="round" />
        </svg>
        <h1 className="login__wordmark">Dough!</h1>
        <p className="login__tagline">Stack that bread.</p>
        <span className="preview-label">{getPreview().label}</span>
      </div>

      {auth && step === 'email' && (
        <form className="login__form" onSubmit={(e) => void onEmail(e)} noValidate>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error' : undefined}
          />
          {error && (
            <p id="login-error" className="login__error" role="alert">
              {error}
            </p>
          )}
          <p className="login__local-note">We'll email you a 6-digit code. No password to remember.</p>
          <LoafButton type="submit" className="login__loaf" disabled={busy}>
            Continue with email
          </LoafButton>
        </form>
      )}

      {auth && step === 'code' && (
        <form className="login__form" onSubmit={(e) => void onCode(e)} noValidate>
          <label htmlFor="code">Enter your code</label>
          <p className="login__local-note" id="code-help">
            We sent a {CODE_LENGTH}-digit code to {email.trim()}.
          </p>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH + 1}
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'login-error code-help' : 'code-help'}
          />
          {error && (
            <p id="login-error" className="login__error" role="alert">
              {error}
            </p>
          )}
          <LoafButton type="submit" className="login__loaf" disabled={busy}>
            Sign in
          </LoafButton>
          <div className="login__links">
            <button type="button" className="login__link" disabled={wait > 0 || busy} onClick={() => void send()}>
              {wait > 0 ? `Send a new code (${wait}s)` : 'Send a new code'}
            </button>
            <button
              type="button"
              className="login__link"
              onClick={() => {
                setStep('email');
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
        </form>
      )}

      {auth && step === 'email' && (
        <div className="login__divider" aria-hidden="true">
          <span className="login__line" />
          <span className="login__or">or</span>
          <span className="login__line" />
        </div>
      )}

      <div className="login__alt">
        {auth && google && step === 'email' && (
          <button type="button" className="google-button" onClick={() => void onGoogle()}>
            <GoogleG />
            <span>Continue with Google</span>
          </button>
        )}
        {step === 'email' && (
          <SliceButton className="slice-button--tall" onClick={() => void onDemo()}>
            Continue as demo user
          </SliceButton>
        )}
      </div>

      {step === 'email' && isDemoMode() && <DemoActions actions={['fresh']} />}

      <p className="login__disclaimer">
        {DISCLAIMER_LINES[0]}
        <br />
        {DISCLAIMER_LINES[1]}
      </p>
    </div>
  );
}
