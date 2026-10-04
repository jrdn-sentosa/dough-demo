// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { AFTER_CLEAR_PATH } from './Settings/ClearDataSection';
import { SettingsView } from './Settings';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});
beforeEach(() => sessionStorage.setItem('dough.demo', '1'));

const data = { ...emptyData(), user: { email: 'sam@school.edu' }, profile: profileFromAnswers({ essentials: '500-749' }) };
const account = { id: 'user-1', email: 'sam@school.edu' };

function mountSettings(props: Partial<Parameters<typeof SettingsView>[0]> = {}) {
  const router = createMemoryRouter(
    [{ path: '/settings', element: <SettingsView account={null} onSignOut={async () => undefined} {...props} /> }],
    { initialEntries: ['/settings'] },
  );
  render(
    <DataProvider adapter={createMemoryAdapter(data)}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
}

const fakeActions = (ok = true) => ({ clear: vi.fn().mockResolvedValue({ ok }), reload: vi.fn() });

describe('Clear app data in Settings', () => {
  it('is only there in demo mode', async () => {
    sessionStorage.clear();
    mountSettings();
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('button', { name: 'Clear app data' })).toBeNull();
  });

  it('asks first, and does nothing until the student confirms', async () => {
    const user = userEvent.setup({ delay: null });
    const actions = fakeActions();
    mountSettings({ clearActions: actions });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));

    expect(screen.getByText(/can't be undone/)).toBeTruthy();
    expect(actions.clear).not.toHaveBeenCalled();
    expect(actions.reload).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Clear app data' })).toBeTruthy();
    expect(actions.clear).not.toHaveBeenCalled();
  });

  it('clears the device, then reloads at the login screen', async () => {
    const user = userEvent.setup({ delay: null });
    const actions = fakeActions();
    mountSettings({ clearActions: actions });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    await waitFor(() => expect(actions.reload).toHaveBeenCalledTimes(1));
    expect(actions.clear).toHaveBeenCalledTimes(1);
    // The clear finishes before the reload, so the reloaded app starts from nothing.
    expect(actions.clear.mock.invocationCallOrder[0]).toBeLessThan(actions.reload.mock.invocationCallOrder[0]);
    expect(AFTER_CLEAR_PATH).toBe('/login?demo=1');
  });

  it('tells the demo user it removes their demo data, and an account that it signs out here only and keeps the account', async () => {
    const user = userEvent.setup({ delay: null });
    mountSettings({ account: null, clearActions: fakeActions() });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));
    expect(screen.getByText(/your demo loaf and answers/)).toBeTruthy();
    expect(screen.queryByText(/signs you out here only/)).toBeNull();
    cleanup();

    mountSettings({ account, clearActions: fakeActions() });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));
    expect(screen.getByText(/signs you out here only/)).toBeTruthy();
    expect(screen.getByText(/stay safe online/)).toBeTruthy();
    expect(screen.getByText(/other devices/)).toBeTruthy();
  });

  it('does not reload when something could not be cleared, and says so', async () => {
    const user = userEvent.setup({ delay: null });
    const actions = fakeActions(false);
    mountSettings({ clearActions: actions });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear it' }));

    expect((await screen.findByRole('alert')).textContent).toContain("couldn't be cleared");
    expect(actions.reload).not.toHaveBeenCalled();
  });

  it('does not reload when clearing throws', async () => {
    const user = userEvent.setup({ delay: null });
    const actions = { clear: vi.fn().mockRejectedValue(new Error('boom')), reload: vi.fn() };
    mountSettings({ clearActions: actions });
    await user.click(await screen.findByRole('button', { name: 'Clear app data' }));
    await user.click(screen.getByRole('button', { name: 'Yes, clear it' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(actions.reload).not.toHaveBeenCalled();
  });
});
