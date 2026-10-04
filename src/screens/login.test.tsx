// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import type { AuthClient } from '../data/auth';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { LoginView } from './Login';

afterEach(cleanup);

function fakeAuth(overrides: Record<string, unknown> = {}) {
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  return auth as unknown as AuthClient & typeof auth;
}

function mount(auth: AuthClient | null) {
  const adapter = createMemoryAdapter();
  render(
    <DataProvider adapter={adapter}>
      <LoginView auth={auth} />
    </DataProvider>,
  );
  return { adapter };
}

async function toCodeStep(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText('Email'), 'sam@school.edu');
  await user.click(screen.getByRole('button', { name: 'Continue with email' }));
  return screen.findByLabelText('Enter your code');
}

describe('login with Supabase', () => {
  it('asks for a real email before sending anything', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    mount(auth);
    await user.type(await screen.findByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect((await screen.findByRole('alert')).textContent).toContain('valid email');
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  it('emails a code, then checks the 6 digits', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    mount(auth);
    await user.type(await screen.findByLabelText('Email'), ' sam@school.edu ');
    await user.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: 'sam@school.edu', options: { shouldCreateUser: true } });

    const input = await screen.findByLabelText('Enter your code');
    expect(input.getAttribute('autocomplete')).toBe('one-time-code');
    expect(input.getAttribute('inputmode')).toBe('numeric');
    await user.type(input, '123456');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'sam@school.edu', token: '123456', type: 'email' });
  });

  it('does not check a short code', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    mount(auth);
    await user.type(await toCodeStep(user), '123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect((await screen.findByRole('alert')).textContent).toContain('6-digit');
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it('shows a friendly message for a wrong or expired code', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth({
      verifyOtp: vi.fn().mockResolvedValue({ data: {}, error: { message: 'Token has expired or is invalid', status: 403 } }),
    });
    mount(auth);
    await user.type(await toCodeStep(user), '000000');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    const text = (await screen.findByRole('alert')).textContent ?? '';
    expect(text).toContain("didn't work");
    expect(text).not.toContain('Token');
  });

  it('shows a friendly message when the connection is down', async () => {
    const user = userEvent.setup();
    mount(fakeAuth({ signInWithOtp: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) }));
    await user.type(await screen.findByLabelText('Email'), 'sam@school.edu');
    await user.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Check your connection');
  });

  it('makes the student wait before asking for another code', async () => {
    const user = userEvent.setup();
    mount(fakeAuth());
    await toCodeStep(user);
    const resend = screen.getByRole('button', { name: /send a new code/i });
    expect((resend as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets the student go back and use a different email', async () => {
    const user = userEvent.setup();
    mount(fakeAuth());
    await toCodeStep(user);
    await user.click(screen.getByRole('button', { name: 'Use a different email' }));
    expect(await screen.findByLabelText('Email')).toBeTruthy();
  });

  it('starts Google sign-in with a redirect back to this site', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    mount(auth);
    await user.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: window.location.origin } });
  });

  it('still offers the demo user, which signs in without Supabase', async () => {
    const user = userEvent.setup();
    const auth = fakeAuth();
    const { adapter } = mount(auth);
    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    await waitFor(async () => expect((await adapter.load()).user).toEqual({ email: 'demo@dough.local' }));
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });
});

describe('login without Supabase', () => {
  it('shows neither the email form nor Google', async () => {
    mount(null);
    await screen.findByRole('button', { name: 'Continue as demo user' });
    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.queryByRole('button', { name: /google|continue with email/i })).toBeNull();
    expect(document.body.textContent).toContain('No real money moves.');
  });
});
