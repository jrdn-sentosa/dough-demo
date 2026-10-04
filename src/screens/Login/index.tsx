import { useState } from 'react';
import type { FormEvent } from 'react';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { useData } from '../../app/DataProvider';
import { signInDemo, signInLocal } from '../../data/session';

export const DISCLAIMER_LINES = ['Educational demo. Not financial advice.', 'No real money moves.'] as const;

/**
 * Sign in. Email sign-in is LOCAL-ONLY (see `session.ts`). Google sign-in is left out
 * until the Supabase milestone wires it up, rather than showing a button that does nothing.
 * Once someone is signed in, the route guard moves them on.
 */
export function Login() {
  const { adapter, refresh } = useData();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const user = await signInLocal(adapter, email);
    if (!user) {
      setError('Please enter a valid email, like you@email.com.');
      return;
    }
    setError(null);
    await refresh();
  }

  async function onDemo() {
    await signInDemo(adapter);
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
      </div>

      <form className="login__form" onSubmit={(e) => void onSubmit(e)} noValidate>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          placeholder="you@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'email-error' : undefined}
        />
        {error && (
          <p id="email-error" className="login__error" role="alert">
            {error}
          </p>
        )}
        <p className="login__local-note">Local-only for this demo. Nothing leaves this device.</p>
        <LoafButton type="submit" className="login__loaf">
          Continue with email
        </LoafButton>
      </form>

      <div className="login__divider" aria-hidden="true">
        <span className="login__line" />
        <span className="login__or">or</span>
        <span className="login__line" />
      </div>

      <div className="login__alt">
        <SliceButton className="slice-button--tall" onClick={() => void onDemo()}>
          Continue as demo user
        </SliceButton>
      </div>

      <p className="login__disclaimer">
        {DISCLAIMER_LINES[0]}
        <br />
        {DISCLAIMER_LINES[1]}
      </p>
    </div>
  );
}
