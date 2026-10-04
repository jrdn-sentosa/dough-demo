import type { SupabaseClient } from '@supabase/supabase-js';

/** The slice of `supabase.auth` we call, so tests can pass a fake. */
export type AuthClient = Pick<SupabaseClient['auth'], 'signInWithOtp' | 'verifyOtp' | 'signInWithOAuth' | 'signOut'>;

export type AuthResult = { ok: true } | { ok: false; message: string };

export const CODE_LENGTH = 6;

const EMAIL = /^\S+@\S+\.\S+$/;

const NETWORK = "We couldn't reach the server. Check your connection and try again.";

/** Plain-language messages. Supabase's own wording is for developers, so it is never shown as is. */
export function friendlyAuthError(error: { message?: string; status?: number; code?: string } | null | undefined): string {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  if (/failed to fetch|network|load failed|fetch failed/i.test(message)) return NETWORK;
  if (error?.status === 429 || /rate.?limit|too many|security purposes/i.test(message) || code.includes('rate_limit')) {
    return 'Too many tries for now. Wait a minute, then try again.';
  }
  if (/expired|invalid|incorrect/i.test(message) || code === 'otp_expired') {
    return "That code didn't work. It may have expired. Check the code, or ask for a new one.";
  }
  return 'Something went wrong on our end. Please try again.';
}

function failed(error: unknown): AuthResult {
  if (error instanceof TypeError) return { ok: false, message: NETWORK };
  return { ok: false, message: friendlyAuthError(error as { message?: string }) };
}

/** Emails a 6-digit one-time code. Creates the account on first use. */
export async function sendEmailCode(auth: AuthClient, email: string): Promise<AuthResult> {
  const trimmed = email.trim();
  if (!EMAIL.test(trimmed)) return { ok: false, message: 'Please enter a valid email, like you@email.com.' };
  try {
    const { error } = await auth.signInWithOtp({ email: trimmed, options: { shouldCreateUser: true } });
    return error ? failed(error) : { ok: true };
  } catch (e) {
    return failed(e);
  }
}

/** Checks the code. On success Supabase starts the session and the app hears about it from `onAuthStateChange`. */
export async function verifyEmailCode(auth: AuthClient, email: string, code: string): Promise<AuthResult> {
  const token = code.replace(/\s/g, '');
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(token)) {
    return { ok: false, message: `Enter the ${CODE_LENGTH}-digit code from your email.` };
  }
  try {
    const { error } = await auth.verifyOtp({ email: email.trim(), token, type: 'email' });
    return error ? failed(error) : { ok: true };
  } catch (e) {
    return failed(e);
  }
}

/** Sends the browser to Google, then back to this site. The session is picked up when the page loads again. */
export async function signInWithGoogle(auth: AuthClient, origin: string): Promise<AuthResult> {
  try {
    const { error } = await auth.signInWithOAuth({ provider: 'google', options: { redirectTo: origin } });
    return error ? failed(error) : { ok: true };
  } catch (e) {
    return failed(e);
  }
}

/**
 * Ends the session on this device only (`scope: 'local'`): the student's other devices stay signed in, and nothing
 * in their account is changed. "Clear app data" uses this. A failure (offline) is reported to the caller, who
 * still removes the saved session from storage.
 */
export async function signOutThisDevice(auth: AuthClient): Promise<void> {
  const { error } = await auth.signOut({ scope: 'local' });
  if (error) throw error;
}

export async function signOutAccount(auth: AuthClient): Promise<void> {
  try {
    await auth.signOut();
  } catch {
    // Offline: the saved session is removed locally either way.
  }
}
