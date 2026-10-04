// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { ERROR_MESSAGE, OFFLINE_MESSAGE } from '../app/AppShell';
import { guardRedirect } from '../app/guard';
import { routes } from '../app/router';
import type { AdapterStatus, DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { AppData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { RETAKE_PATH, SettingsView } from './Settings';

afterEach(cleanup);

const profile = profileFromAnswers({ essentials: '500-749' });
const accountData: AppData = { ...emptyData(), user: { email: 'sam@school.edu' }, profile };
const account = { id: 'user-1', email: 'sam@school.edu' };

function mountSettings(data: AppData, props: Partial<Parameters<typeof SettingsView>[0]> = {}) {
  const router = createMemoryRouter(
    [{ path: '/settings', element: <SettingsView account={null} onSignOut={async () => undefined} {...props} /> }, { path: '*', element: <p>elsewhere</p> }],
    { initialEntries: ['/settings'] },
  );
  render(
    <DataProvider adapter={createMemoryAdapter(data)}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return router;
}

describe('Settings', () => {
  it('shows the signed-in email and signs out a real account', async () => {
    const user = userEvent.setup({ delay: null });
    const onSignOut = vi.fn().mockResolvedValue(undefined);
    mountSettings(accountData, { account, onSignOut });
    expect((await screen.findByText('sam@school.edu')).tagName).toBe('STRONG');
    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledWith(account);
  });

  it('has no sign out and no email for the demo user, who has no account', async () => {
    mountSettings({ ...accountData, user: { email: 'demo@dough.local' } });
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
    expect(document.body.textContent).not.toContain('demo@dough.local');
  });

  it('links to the placement retake and comes back to Settings afterwards', async () => {
    mountSettings(accountData);
    const link = await screen.findByRole('link', { name: 'Retake the quiz' });
    expect(link.getAttribute('href')).toBe(RETAKE_PATH);
    expect(RETAKE_PATH).toBe('/placement?retake=1&return=%2Fsettings');
  });

  it('shows the disclaimer', async () => {
    mountSettings(accountData);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(document.body.textContent).toContain('Educational demo. Not financial advice.');
    expect(document.body.textContent).toContain('No real money moves.');
  });

  it('is reachable by a signed-in student and not by a signed-out one', () => {
    expect(guardRedirect('/settings', accountData)).toBeNull();
    expect(guardRedirect('/settings', emptyData())).toBe('/login');
  });
});

describe('Exit demo', () => {
  const demoData: AppData = { ...accountData, user: { email: 'demo@dough.local' } };

  function mountApp(adapter: DataAdapter) {
    const router = createMemoryRouter(routes, { initialEntries: ['/settings'] });
    render(
      <DataProvider adapter={adapter}>
        <RouterProvider router={router} />
      </DataProvider>,
    );
    return router;
  }

  it('is shown to the demo user, and account users get Sign out instead', async () => {
    mountSettings(demoData);
    expect(await screen.findByRole('button', { name: 'Exit demo' })).toBeTruthy();
    cleanup();
    mountSettings(accountData, { account });
    await screen.findByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('button', { name: 'Exit demo' })).toBeNull();
  });

  it('goes back to the login screen and keeps the demo data for next time', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = createMemoryAdapter(demoData);
    const router = mountApp(adapter);
    await user.click(await screen.findByRole('button', { name: 'Exit demo' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    const kept = await adapter.load();
    expect(kept.user).toBeNull();
    expect(kept.profile).toEqual(demoData.profile);

    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    await waitFor(async () => expect((await adapter.load()).user).toEqual({ email: 'demo@dough.local' }));
    expect((await adapter.load()).profile).toEqual(demoData.profile);
  });
});

describe('connection banner', () => {
  function adapterReporting(): { adapter: DataAdapter; report: (s: AdapterStatus) => void } {
    const inner = createMemoryAdapter(accountData);
    let listener: ((s: AdapterStatus) => void) | null = null;
    return {
      adapter: {
        load: () => inner.load(),
        save: (d) => inner.save(d),
        onStatus(l) {
          listener = l;
          return () => void (listener = null);
        },
      },
      report: (s) => listener?.(s),
    };
  }

  function mountApp(adapter: DataAdapter) {
    const router = createMemoryRouter(routes, { initialEntries: ['/settings'] });
    render(
      <DataProvider adapter={adapter}>
        <RouterProvider router={router} />
      </DataProvider>,
    );
  }

  it('says so when the connection drops, keeps the screen readable, and goes away when it is back', async () => {
    const { adapter, report } = adapterReporting();
    mountApp(adapter);
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('status')).toBeNull();

    report('offline');
    expect((await screen.findByRole('status')).textContent).toBe(OFFLINE_MESSAGE);
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();

    report('error');
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe(ERROR_MESSAGE));

    report('online');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('never shows for adapters that cannot go offline', async () => {
    mountApp(createMemoryAdapter(accountData));
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
