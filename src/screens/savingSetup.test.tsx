// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { AppData } from '../data/types';
import { answersFromProfile, profileFromAnswers } from '../domain/profile';
import type { PlacementAnswers } from '../domain/placement';
import { startLoaf } from '../money/ledger';

afterEach(cleanup);

const quizDone = { id: 'quiz-1', loafId: 'emergency-fund' as const, mode: 'lesson' as const, score: 2, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };

/** A student who finished the quiz and is about to set up saving, with a $400 goal (so the weekly suggestion is $35). */
async function setupAdapter(answers: PlacementAnswers): Promise<DataAdapter> {
  const data: AppData = { ...emptyData(), user: { email: 'a@b.co' }, profile: profileFromAnswers(answers), quizAttempts: [quizDone] };
  const adapter = createMemoryAdapter(data);
  await startLoaf(adapter, 'emergency-fund', 40_000);
  return adapter;
}

const noSavings: PlacementAnswers = { essentials: '250-499', accounts: ['checking'], cardDebt: 'no', earnedIncome: true };
const hasSavings: PlacementAnswers = { ...noSavings, accounts: ['checking', 'regular-savings'] };

function mount(adapter: DataAdapter, path = '/saving-setup') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { pathname: () => router.state.location.pathname };
}

const hysaTitle = 'Open a high-yield savings account';
const habitTitle = 'Pick a saving habit';

describe('saving setup: the high-yield account step', () => {
  it('comes first when the account rules say so, with the what-to-look-for points', async () => {
    mount(await setupAdapter(noSavings));
    await screen.findByRole('heading', { name: hysaTitle });
    for (const point of ['Insured by the FDIC (banks) or the NCUA (credit unions)', 'Low or no fees', "No minimum balance that's hard to meet", 'Easy access when you need your money']) {
      expect(screen.getByText(point)).toBeTruthy();
    }
    expect(screen.getByText('In this demo, no real account is opened and no real money moves.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I have one now' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "I'll do this later" })).toBeTruthy();
  });

  it('is skipped when the student already has a savings account', async () => {
    mount(await setupAdapter(hasSavings));
    await screen.findByRole('heading', { name: habitTitle });
    expect(screen.queryByRole('heading', { name: hysaTitle })).toBeNull();
  });

  it('is skipped for a student who already has a high-yield account', async () => {
    mount(await setupAdapter({ ...noSavings, accounts: ['high-yield-savings'] }));
    await screen.findByRole('heading', { name: habitTitle });
  });

  it('is asked of a student who skipped the accounts question', async () => {
    mount(await setupAdapter({ cardDebt: 'no' }));
    await screen.findByRole('heading', { name: hysaTitle });
  });

  it('"I have one now" adds high-yield savings to the profile and moves on', async () => {
    const adapter = await setupAdapter(noSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'I have one now' }));
    await screen.findByRole('heading', { name: habitTitle });

    const data = await adapter.load();
    expect(data.profile?.accounts).toEqual(['checking', 'high-yield-savings']);
    expect(data.hysaCard).toBeNull();
    // A retake shows it already selected, and a later loaf would skip the step.
    expect(answersFromProfile(data.profile!).accounts).toContain('high-yield-savings');
  });

  it('"I\'ll do this later" never blocks: it moves on and leaves a reminder for Home', async () => {
    const adapter = await setupAdapter(noSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: "I'll do this later" }));
    await screen.findByRole('heading', { name: habitTitle });
    const data = await adapter.load();
    expect(data.hysaCard).toBe('pending');
    expect(data.profile?.accounts).toEqual(['checking']);
  });

  it('puts the reminder card on Home after the rest of setup', async () => {
    const adapter = await setupAdapter(noSavings);
    const user = userEvent.setup();
    const { pathname } = mount(adapter);
    await user.click(await screen.findByRole('button', { name: "I'll do this later" }));
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(await screen.findByRole('button', { name: 'Go to my loaf' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
    const card = screen.getByRole('region', { name: hysaTitle });
    await user.click(within(card).getByRole('button', { name: 'I have one now' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: hysaTitle })).toBeNull());
    expect((await adapter.load()).profile?.accounts).toContain('high-yield-savings');
  });
});

describe('saving setup: the habit', () => {
  it('suggests the weekly amount (target over 12 weeks, rounded up to $5) and lets the student edit it', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    mount(adapter);
    await screen.findByRole('heading', { name: habitTitle });
    expect(screen.getByText(/\$35 a week gets you to your goal in about one semester/)).toBeTruthy();
    const input = screen.getByLabelText('Amount each week') as HTMLInputElement;
    expect(input.value).toBe('35');

    await user.clear(input);
    await user.type(input, '40');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Make it automatic' });
    expect((await adapter.load()).habit).toMatchObject({ kind: 'weekly', amountCents: 4_000, paycheckCents: null, frequency: null });
  });

  it('does not continue with an amount that is not dollars', async () => {
    const user = userEvent.setup();
    mount(await setupAdapter(hasSavings));
    const input = (await screen.findByLabelText('Amount each week')) as HTMLInputElement;
    await user.clear(input);
    await user.type(input, 'abc');
    expect((screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('saves 10% of each paycheck, editable, with how often they are paid', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('radio', { name: 'Save from each paycheck' }));
    expect(screen.getByText('Move 10% of every paycheck to your savings.')).toBeTruthy();
    for (const label of ['Every week', 'Every two weeks', 'Twice a month', 'Once a month', 'It varies']) {
      expect(screen.getByRole('radio', { name: label })).toBeTruthy();
    }
    const continueButton = screen.getByRole('button', { name: 'Continue' }) as HTMLButtonElement;
    expect(continueButton.disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: 'Every two weeks' }));
    await user.type(screen.getByLabelText('About how much is one paycheck?'), '500');
    expect(screen.getByText("That's 10% of $500. You can change the amount.")).toBeTruthy();
    const amount = screen.getByLabelText('Amount from each paycheck') as HTMLInputElement;
    expect(amount.value).toBe('50');
    expect(continueButton.disabled).toBe(false);

    await user.clear(amount);
    await user.type(amount, '60');
    await user.click(continueButton);
    await screen.findByRole('heading', { name: 'Make it automatic' });
    expect((await adapter.load()).habit).toMatchObject({ kind: 'paycheck', amountCents: 6_000, paycheckCents: 50_000, frequency: 'biweekly' });
  });

  it('asks how often they are paid, and the Home card tracks that period', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('radio', { name: 'Save from each paycheck' }));
    await user.click(screen.getByRole('radio', { name: 'Once a month' }));
    await user.type(screen.getByLabelText('About how much is one paycheck?'), '1000');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Go to my loaf' }));
    const card = await screen.findByRole('region', { name: 'This month' });
    expect(within(card).getByText('$100 to your loaf')).toBeTruthy();
    expect(within(card).getByText('Not logged yet')).toBeTruthy();
  });

  it('for "it varies" the Home card says "Each paycheck" and has no logged status', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('radio', { name: 'Save from each paycheck' }));
    await user.click(screen.getByRole('radio', { name: 'It varies' }));
    await user.type(screen.getByLabelText('About how much is one paycheck?'), '300');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByRole('button', { name: 'Go to my loaf' }));
    const card = await screen.findByRole('region', { name: 'Each paycheck' });
    expect(within(card).getByText('$30 to your loaf')).toBeTruthy();
    expect(within(card).getByText('Nothing added yet')).toBeTruthy();
    expect(within(card).queryByText('Not logged yet')).toBeNull();
    expect((await adapter.load()).habit).toMatchObject({ kind: 'paycheck', frequency: 'varies', amountCents: 3_000 });
  });

  it('"Skip for now" saves the suggested weekly amount and says it can be changed in Settings', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Make it automatic' });
    expect(screen.getByText('We started you with a weekly habit. You can change it in Settings.')).toBeTruthy();
    expect((await adapter.load()).habit).toMatchObject({ kind: 'weekly', amountCents: 3_500 });
  });
});

describe('saving setup: make it automatic, then Home', () => {
  it('suggests an automatic transfer, then goes to Home with the habit card', async () => {
    const adapter = await setupAdapter(hasSavings);
    const user = userEvent.setup();
    const { pathname } = mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Make it automatic' });
    expect(screen.getByText(/set up a transfer to your savings account for payday or once a week/)).toBeTruthy();
    expect(screen.queryByText(/You can change it in Settings/)).toBeNull(); // only after skipping

    await user.click(screen.getByRole('button', { name: 'Go to my loaf' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
    expect(screen.getByText('$35 to your loaf')).toBeTruthy();
  });

  it('holds Home at saving setup until a habit is saved', async () => {
    const adapter = await setupAdapter(hasSavings);
    const { pathname } = mount(adapter, '/');
    await screen.findByRole('heading', { name: habitTitle });
    expect(pathname()).toBe('/saving-setup');
  });
});
