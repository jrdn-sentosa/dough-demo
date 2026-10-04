// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { streakFromData } from '../data/streaks';
import { emptyData } from '../data/types';
import type { AppData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { mayaSeed } from '../money/seed';
import { SettingsView } from './Settings';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const NOW = new Date();
const account = { id: 'user-1', email: 'sam@school.edu' };

function mount(data: AppData, props: Partial<Parameters<typeof SettingsView>[0]> = {}): DataAdapter {
  const adapter = createMemoryAdapter(data);
  const router = createMemoryRouter(
    [{ path: '/settings', element: <SettingsView account={null} onSignOut={async () => undefined} {...props} /> }],
    { initialEntries: ['/settings'] },
  );
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return adapter;
}

describe('Settings, Change your goal', () => {
  it("offers 1, 3 and 6 months from the student's essentials, and changes the goal", async () => {
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    await screen.findByText('Your goal is $400.');
    expect(screen.getByRole('radio', { name: '1 month ($400)' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: '6 months ($2,400)' })).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: '3 months ($1,200)' }));
    await user.click(screen.getByRole('button', { name: 'Change my goal' }));
    expect((await screen.findByRole('status')).textContent).toBe('Your goal is now $1,200.');
    expect((await adapter.load()).loaves[0].targetCents).toBe(120_000);
    expect(screen.getByText('Your goal is $1,200.')).toBeTruthy();
  });

  it('takes a typed amount, and a goal at or below what is saved bakes the loaf', async () => {
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    await user.type(await screen.findByLabelText('Or type an amount'), '200');
    await user.click(screen.getByRole('button', { name: 'Change my goal' }));
    expect((await screen.findByRole('status')).textContent).toContain('your loaf is baked');
    const loaf = (await adapter.load()).loaves[0];
    expect(loaf.targetCents).toBe(20_000);
    expect(loaf.bakes).toHaveLength(1);
  });

  it('will not save something that is not a dollar amount', async () => {
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    await user.type(await screen.findByLabelText('Or type an amount'), 'lots');
    expect((screen.getByRole('button', { name: 'Change my goal' }) as HTMLButtonElement).disabled).toBe(true);
    expect((await adapter.load()).loaves[0].targetCents).toBe(40_000);
  });

  it('asks for essentials before offering months when they are unknown, but still takes an amount', async () => {
    const data = mayaSeed(NOW);
    data.profile = profileFromAnswers({ essentials: 'not-sure' });
    mount(data);
    await screen.findByText(/retaking the quiz to pick a goal in months/);
    expect(screen.queryByRole('radio', { name: /month/ })).toBeNull();
    expect(screen.getByLabelText('Or type an amount')).toBeTruthy();
  });

  it('has no goal section before a loaf exists', async () => {
    mount({ ...emptyData(), user: { email: 'demo@dough.local' } });
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('heading', { name: 'Your goal' })).toBeNull();
  });
});

describe('Settings, Change your habit', () => {
  it('shows the current habit', async () => {
    mount(mayaSeed(NOW));
    await screen.findByText('Right now: $40 a week.');
  });

  it('changes the amount without touching the streak, and shows no restart note', async () => {
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    const before = (await adapter.load()).habit;
    const field = await screen.findByLabelText("Amount each week");
    await user.clear(field);
    await user.type(field, '50');
    expect(screen.queryByText(/starts a new streak/)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Save my habit' }));
    expect((await screen.findByRole('status')).textContent).toBe('Your habit is saved.');
    const data = await adapter.load();
    expect(data.habit).toMatchObject({ amountCents: 5_000, startedAt: before?.startedAt });
    expect(streakFromData(data)).toBe(6);
  });

  it('warns before a different period length restarts the streak, and keeps breads and the best streak', async () => {
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    const before = await adapter.load();
    await user.click(await screen.findByRole('radio', { name: /paycheck/i }));
    await user.click(screen.getByRole('radio', { name: 'Every two weeks' }));
    await user.type(document.querySelector('#habit-paycheck') as HTMLInputElement, '500');
    expect(screen.getByText(/starts a new streak/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Save my habit' }));
    expect((await screen.findByRole('status')).textContent).toContain('A new streak starts now');
    const data = await adapter.load();
    expect(data.habit?.startedAt).not.toBe(before.habit?.startedAt);
    expect(streakFromData(data)).toBeLessThan(6);
    expect(data.streaks).toEqual(before.streaks);
  });
});

describe('Settings, demo tools', () => {
  it('shows Reset demo and Start fresh demo to the demo user in demo mode, and Reset puts Maya back', async () => {
    sessionStorage.setItem('dough.demo', '1');
    const user = userEvent.setup();
    const adapter = mount(mayaSeed(NOW));
    const data = await adapter.load();
    data.transactions = data.transactions.slice(0, 2);
    await adapter.save(data);
    await user.click(await screen.findByRole('button', { name: 'Reset demo' }));
    await user.click(screen.getByRole('button', { name: 'Yes, do it' }));
    await screen.findByRole('button', { name: 'Reset demo' });
    expect((await adapter.load()).transactions).toHaveLength(6);
    expect(screen.getByRole('button', { name: 'Start fresh demo' })).toBeTruthy();
  });

  it('is hidden without demo mode', async () => {
    mount(mayaSeed(NOW));
    await screen.findByRole('heading', { name: 'Settings' });
    expect(screen.queryByRole('button', { name: 'Reset demo' })).toBeNull();
  });

  it('is never shown for a real account, even in demo mode', async () => {
    sessionStorage.setItem('dough.demo', '1');
    const data = mayaSeed(NOW);
    data.user = { email: account.email };
    mount(data, { account });
    await screen.findByRole('button', { name: 'Sign out' });
    expect(screen.queryByRole('button', { name: 'Reset demo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start fresh demo' })).toBeNull();
  });
});
