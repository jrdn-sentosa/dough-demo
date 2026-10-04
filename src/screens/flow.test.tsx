// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { AppData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import type { PlacementAnswers } from '../domain/placement';

afterEach(cleanup);

function mount(path: string, data: AppData): { adapter: DataAdapter; pathname: () => string } {
  const adapter = createMemoryAdapter(data);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { adapter, pathname: () => router.state.location.pathname };
}

const signedIn: AppData = { ...emptyData(), user: { email: 'a@b.co' } };
const withAnswers = (answers: PlacementAnswers): AppData => ({ ...signedIn, profile: profileFromAnswers(answers) });

describe('sign in', () => {
  it('signs in with an email and moves on to placement', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/login', emptyData());
    await user.type(await screen.findByLabelText('Email'), 'sam@school.edu');
    await user.click(screen.getByRole('button', { name: 'Continue with email' }));
    await waitFor(() => expect(pathname()).toBe('/placement'));
    expect((await adapter.load()).user).toEqual({ email: 'sam@school.edu' });
  });

  it('asks for a real email', async () => {
    const user = userEvent.setup();
    mount('/login', emptyData());
    await user.type(await screen.findByLabelText('Email'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Continue with email' }));
    expect((await screen.findByRole('alert')).textContent).toContain('valid email');
  });

  it('"Continue as demo user" signs in a plain demo user who starts placement', async () => {
    const user = userEvent.setup();
    const { pathname } = mount('/login', emptyData());
    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    await waitFor(() => expect(pathname()).toBe('/placement'));
  });
});

describe('placement quiz', () => {
  it('keeps the answers given when the student skips, and fills the rest with defaults', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/placement', signedIn);

    await user.click(await screen.findByRole('radio', { name: '$500–$749' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('radio', { name: '$100–$249' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));

    expect((await screen.findByRole('alertdialog')).textContent).toContain('default goal of $1,000');
    await user.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => expect(pathname()).toBe('/placement/result'));
    const profile = (await adapter.load()).profile;
    expect(profile).toMatchObject({
      placementStatus: 'partial',
      essentials: '500-749',
      savings: '100-249',
      accounts: null,
      cardDebt: null,
      earnedIncome: null,
    });
  });

  it('skipping before answering anything stores a skipped placement', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/placement', signedIn);
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(pathname()).toBe('/placement/result'));
    expect((await adapter.load()).profile?.placementStatus).toBe('skipped');
    expect(await screen.findByText(/a default you can change in Settings/)).toBeTruthy();
  });

  it('"Keep answering" closes the confirmation and stays on the question', async () => {
    const user = userEvent.setup();
    const { pathname } = mount('/placement', signedIn);
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(pathname()).toBe('/placement');
    expect(screen.getByRole('radio', { name: 'Not sure' })).toBeTruthy();
  });

  it('Q3: "None of these" and "Not sure" clear the other choices', async () => {
    const user = userEvent.setup();
    mount('/placement', signedIn);
    await user.click(await screen.findByRole('radio', { name: '$500–$749' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await user.click(await screen.findByRole('radio', { name: 'None' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));

    const box = (name: string | RegExp) => screen.getByRole('checkbox', { name }) as HTMLInputElement;
    await screen.findByRole('checkbox', { name: 'Checking account' });

    await user.click(box('Checking account'));
    await user.click(box('Regular savings account'));
    expect(box('Checking account').checked && box('Regular savings account').checked).toBe(true);

    await user.click(box('None of these'));
    expect(box('None of these').checked).toBe(true);
    expect(box('Checking account').checked).toBe(false);
    expect(box('Regular savings account').checked).toBe(false);

    await user.click(box('Not sure'));
    expect(box('Not sure').checked).toBe(true);
    expect(box('None of these').checked).toBe(false);

    await user.click(box('Checking account'));
    expect(box('Checking account').checked).toBe(true);
    expect(box('Not sure').checked).toBe(false);
  });
});

describe('your new loaf', () => {
  it('asks "Is that right?" over $10,000 and starts nothing until the student says yes', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount(
      '/new-loaf',
      withAnswers({ essentials: '1500-plus', savings: '1000-plus', accounts: ['checking'], cardDebt: 'no', earnedIncome: true, essentialsExactCents: 400_000 }),
    );

    await user.click(await screen.findByLabelText('3 months: $12,000'));
    // Reported savings are counted by default, so the exact amount is already showing.
    const savings = await screen.findByLabelText('Exact amount (optional)');
    await user.clear(savings);
    await user.type(savings, '10500');
    await user.click(screen.getByRole('button', { name: 'Start my loaf' }));

    expect((await screen.findByRole('alertdialog')).textContent).toContain('Is $10,500 right?');
    expect((await adapter.load()).loaves).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Let me fix it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect((await adapter.load()).loaves).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Start my loaf' }));
    await user.click(await screen.findByRole('button', { name: "Yes, that's right" }));

    await waitFor(() => expect(pathname()).toBe('/'));
    const saved = await adapter.load();
    expect(saved.loaves).toHaveLength(1);
    expect(saved.transactions).toMatchObject([{ type: 'starting', amountCents: 1_050_000 }]);
  });

  it('starts a plain loaf with the suggested goal', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/new-loaf', withAnswers({ essentials: '500-749', savings: 'none' }));
    await user.click(await screen.findByRole('button', { name: 'Start my loaf' }));
    await waitFor(() => expect(pathname()).toBe('/'));
    const saved = await adapter.load();
    expect(saved.loaves[0].targetCents).toBe(65_000);
    expect(saved.transactions).toHaveLength(0);
  });

  it('counts any reported savings by default, even under one month, and lets the student uncheck it', async () => {
    const user = userEvent.setup();
    mount('/new-loaf', withAnswers({ essentials: '500-749', savings: '500-999' })); // $500 of a $650 month
    const box = (await screen.findByRole('checkbox', { name: 'Count the money I already have set aside' })) as HTMLInputElement;
    expect(box.checked).toBe(true);
    await user.click(box);
    expect(box.checked).toBe(false);
  });

  it('blocks a goal that existing savings already cover', async () => {
    const user = userEvent.setup();
    mount('/new-loaf', withAnswers({ essentials: 'under-250', savings: '250-499' }));
    // Savings between 1 and 3 months are counted by default.
    expect(((await screen.findByRole('checkbox', { name: 'Count the money I already have set aside' })) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'A different amount' }));
    await user.type(screen.getByLabelText('A different amount', { selector: 'input[type="text"], input:not([type])' }), '100');
    expect((await screen.findByRole('status')).textContent).toContain('Pick a bigger one');
    expect((screen.getByRole('button', { name: 'Start my loaf' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a fund that is already built goes to the shelf and on to ChooseLoaf', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/new-loaf', withAnswers({ essentials: 'under-250', savings: '1000-plus', cardDebt: 'no' }));
    await user.click(await screen.findByRole('button', { name: 'Choose your next loaf' }));
    await waitFor(() => expect(pathname()).toBe('/choose-loaf'));
    const saved = await adapter.load();
    expect(saved.loaves[0].bakes).toMatchObject([{ at: null }]);
  });
});
