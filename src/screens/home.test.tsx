// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { saveHabit, setHysaCard } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import type { PayFrequency } from '../domain/habits';
import { profileFromAnswers } from '../domain/profile';
import { advance } from '../money/clock';
import { addStarting, deposit, setTarget, startLoaf, withdraw } from '../money/ledger';

afterEach(cleanup);

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;
const user = { email: 'a@b.co' };
const accounts = ['checking', 'regular-savings'] as const;

function quizAttempt(score: number): QuizAttempt {
  return { id: 'quiz-1', loafId: EF, mode: 'lesson', score, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };
}

interface Setup {
  target?: number;
  /** Savings already there ("Savings you already had"), so the habit card stays "Not logged yet". */
  starting?: number;
  habit?: 'weekly' | PayFrequency | null;
  quiz?: number;
  accountList?: readonly ('checking' | 'regular-savings' | 'high-yield-savings')[];
  hysaCard?: 'pending' | 'dismissed' | null;
}

/** A returning student on Home. Everything goes through the money layer, so the rows are real. */
async function homeAdapter(setup: Setup = {}): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user,
    profile: profileFromAnswers({ essentials: '250-499', accounts: [...(setup.accountList ?? accounts)], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [quizAttempt(setup.quiz ?? 2)],
  });
  await startLoaf(adapter, EF, setup.target ?? dollars(400));
  if (setup.starting) await addStarting(adapter, EF, setup.starting);
  const habit = setup.habit === undefined ? 'weekly' : setup.habit;
  if (habit === 'weekly') await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
  else if (habit) await saveHabit(adapter, { kind: 'paycheck', amountCents: dollars(20), paycheckCents: dollars(200), frequency: habit });
  if (setup.hysaCard) await setHysaCard(adapter, setup.hysaCard);
  return adapter;
}

function mount(adapter: DataAdapter, path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { router, pathname: () => router.state.location.pathname };
}

const stageOf = () => document.querySelector('.loaf-art')?.getAttribute('data-stage');
const habitCard = () => screen.getByRole('region', { name: /this week|these two weeks|this half month|this month|each paycheck/i });
const tipButton = (name: string) => screen.getByRole('button', { name: new RegExp(name) });

describe('Home', () => {
  it('shows the loaf at its stage with the amount, stage line and progress bar', async () => {
    mount(await homeAdapter({ starting: dollars(240) }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.getByText('$240')).toBeTruthy();
    expect(screen.getByText('of $400')).toBeTruthy();
    expect(screen.getByText('Proofing · 60% of your goal')).toBeTruthy();
    expect(screen.getByText('Kept in your savings account')).toBeTruthy();
    expect(stageOf()).toBe('proof');
    const bar = screen.getByRole('progressbar', { name: 'Progress toward your goal' });
    expect(bar.getAttribute('aria-valuenow')).toBe('60');
    for (const name of ['Mix', 'Shape', 'Proof', 'Bake', 'Done']) expect(within(bar).getByText(name)).toBeTruthy();
    expect(screen.getByText('Educational demo. No real money moves.')).toBeTruthy();
  });

  it('starts as a dough ball at zero', async () => {
    mount(await homeAdapter());
    await screen.findByText('Mixing · 0% of your goal');
    expect(stageOf()).toBe('mix');
  });

  it('shows the "Lessons mastered" badge only once the best quiz score is 4 of 5', async () => {
    mount(await homeAdapter({ quiz: 4 }));
    await screen.findByText('Lessons mastered');
    cleanup();
    mount(await homeAdapter({ quiz: 3 }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.queryByText('Lessons mastered')).toBeNull();
  });
});

describe('weekly habit card', () => {
  it('says "Not logged yet" until the week has a deposit, then "Logged"', async () => {
    const adapter = await homeAdapter({ starting: dollars(240) });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('$35 to your loaf');
    expect(within(habitCard()).getByText('This week')).toBeTruthy();
    expect(within(habitCard()).getByText('Not logged yet')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    await user.click(screen.getByRole('button', { name: 'I moved $35 to savings' }));
    await waitFor(() => expect(within(habitCard()).getByText('Logged')).toBeTruthy());
  });

  it('follows the demo clock: a new week is not logged yet', async () => {
    const adapter = await homeAdapter({ starting: dollars(240) });
    await deposit(adapter, EF, dollars(35));
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('Logged')).toBeTruthy());
    cleanup();
    await advance(adapter, 7);
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('Not logged yet')).toBeTruthy());
  });

  it('tracks the matching period for a paycheck habit', async () => {
    const adapter = await homeAdapter({ starting: dollars(240), habit: 'biweekly' });
    await deposit(adapter, EF, dollars(20));
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('These two weeks')).toBeTruthy());
    expect(within(habitCard()).getByText('Logged')).toBeTruthy();
    cleanup();
    await advance(adapter, 7); // still the same two-week period
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('Logged')).toBeTruthy());
    cleanup();
    await advance(adapter, 7);
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('Not logged yet')).toBeTruthy());
  });

  it('for "it varies" shows "Each paycheck" and when they last added, with no logged status', async () => {
    const adapter = await homeAdapter({ starting: dollars(240), habit: 'varies' });
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText('Each paycheck')).toBeTruthy());
    expect(within(habitCard()).getByText('$20 to your loaf')).toBeTruthy();
    expect(within(habitCard()).getByText('Nothing added yet')).toBeTruthy();
    cleanup();

    await deposit(adapter, EF, dollars(20));
    mount(adapter);
    await waitFor(() => expect(within(habitCard()).getByText(/^Last added /)).toBeTruthy());
    expect(within(habitCard()).queryByText('Logged')).toBeNull();
    expect(within(habitCard()).queryByText('Not logged yet')).toBeNull();
  });
});

describe('add to my loaf', () => {
  it('opens prefilled with the habit amount, and the button confirms the amount', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter({ starting: dollars(80) }));
    await user.click(await screen.findByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?') as HTMLInputElement;
    expect(input.value).toBe('35');
    expect(screen.getByRole('button', { name: 'I moved $35 to savings' })).toBeTruthy();

    await user.clear(input);
    await user.type(input, '12.50');
    expect(screen.getByRole('button', { name: 'I moved $12.50 to savings' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('logs a simulated deposit and moves the loaf to its new stage, saying so and pointing to the new tip', async () => {
    const adapter = await homeAdapter({ starting: dollars(80) }); // 20%: mix
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Mixing · 20% of your goal');
    expect(stageOf()).toBe('mix');

    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?');
    await user.clear(input);
    await user.type(input, '50');
    await user.click(screen.getByRole('button', { name: 'I moved $50 to savings' }));

    await screen.findByText('Shaping · 32% of your goal');
    expect(stageOf()).toBe('shape');
    expect(screen.getByText('$130')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Nice! Your loaf is now shaping. A new tip is unlocked: Why small deposits add up.');
    expect(screen.queryByRole('dialog')).toBeNull();

    const rows = (await adapter.load()).transactions.filter((t) => t.type === 'deposit');
    expect(rows).toEqual([expect.objectContaining({ amountCents: dollars(50), source: 'manual' })]);

    // "Read it now" opens the tip and clears its New badge.
    expect(within(tipButton('Why small deposits add up')).getByText('New')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Read it now' }));
    expect(await screen.findByText(/A small deposit every week adds up/)).toBeTruthy();
    await waitFor(() => expect(within(tipButton('Why small deposits add up')).queryByText('New')).toBeNull());
  });

  it('says nothing about stages when the deposit stays in the same stage', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter({ starting: dollars(80) }));
    await user.click(await screen.findByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?');
    await user.clear(input);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: 'I moved $5 to savings' }));
    await screen.findByText('$85');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('refuses amounts that are not dollars or look like a typo, without writing anything', async () => {
    const adapter = await homeAdapter({ starting: dollars(80) });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?');

    await user.clear(input);
    await user.type(input, 'lots');
    expect((screen.getByRole('button', { name: /^I moved/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Enter a dollar amount, like 25.');

    await user.clear(input);
    await user.type(input, '20000');
    expect((screen.getByRole('button', { name: /^I moved/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toContain('Double-check the amount for a typo');
    expect((await adapter.load()).transactions.filter((t) => t.type === 'deposit')).toEqual([]);
  });

  it('goes to the celebration when the deposit bakes the loaf', async () => {
    const adapter = await homeAdapter({ starting: dollars(360) }); // 90%: bake
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter);
    await screen.findByText('Baking · 90% of your goal');
    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?');
    await user.clear(input);
    await user.type(input, '40');
    await user.click(screen.getByRole('button', { name: 'I moved $40 to savings' }));
    await screen.findByRole('heading', { name: 'Your loaf is baked!' });
    expect(pathname()).toBe('/loaf-complete');
    expect((await adapter.load()).loaves[0].bakes).toHaveLength(1);
  });
});

describe('use my fund', () => {
  it('shows what is available, then logs the withdrawal with the supportive message and a smaller loaf', async () => {
    const adapter = await homeAdapter({ starting: dollars(240) }); // 60%: proof
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Proofing · 60% of your goal');
    await user.click(screen.getByRole('button', { name: 'Use my fund' }));
    expect(screen.getByText('You have $240 in your fund.')).toBeTruthy();
    const input = screen.getByLabelText('How much do you need?') as HTMLInputElement;
    expect(input.value).toBe('');
    await user.type(input, '200');
    await user.click(screen.getByRole('button', { name: 'Use $200 from my fund' }));

    await screen.findByText('Mixing · 10% of your goal');
    expect(stageOf()).toBe('mix');
    const note = screen.getByRole('status').textContent ?? '';
    expect(note).toContain("You used your fund for what it's for. Let's rebuild.");
    expect(note).toContain('Your loaf is back to mixing.');
    expect(note).not.toMatch(/failed|lost|broke/i);
    expect((await adapter.load()).transactions.at(-1)).toMatchObject({ type: 'withdrawal', amountCents: dollars(200) });
  });

  it('tells them what is available when they ask for more than the fund holds', async () => {
    const adapter = await homeAdapter({ starting: dollars(240) });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Use my fund' }));
    await user.type(screen.getByLabelText('How much do you need?'), '300');
    await user.click(screen.getByRole('button', { name: 'Use $300 from my fund' }));
    expect((await screen.findByRole('alert')).textContent).toBe('You have $240 available to use right now.');
    expect((await adapter.load()).transactions.filter((t) => t.type === 'withdrawal')).toEqual([]);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('rebuild mode', () => {
  async function bakedThenUsed() {
    const adapter = await homeAdapter({ target: dollars(200) });
    await deposit(adapter, EF, dollars(200)); // baked
    await withdraw(adapter, EF, dollars(120)); // $80 left: 40%
    return adapter;
  }

  it('reads "Rebuilding" at the stage that matches the balance, and keeps every tip open', async () => {
    mount(await bakedThenUsed());
    await screen.findByText('Rebuilding · 40% of your goal');
    expect(screen.getByText('$80')).toBeTruthy();
    expect(screen.getByText('of $200')).toBeTruthy();
    expect(stageOf()).toBe('shape');
    expect(screen.queryByText(/^Whole fund/)).toBeNull();
    // The fund has baked, so a withdrawal doesn't lock tips it already earned.
    expect(screen.queryByText(/^Unlocks/)).toBeNull();
  });

  it('shows the rebuild message after using a baked fund', async () => {
    const adapter = await homeAdapter({ target: dollars(200) });
    await deposit(adapter, EF, dollars(200));
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Use my fund' }));
    await user.type(screen.getByLabelText('How much do you need?'), '120');
    await user.click(screen.getByRole('button', { name: 'Use $120 from my fund' }));
    await screen.findByText('Rebuilding · 40% of your goal');
    expect(screen.getByRole('status').textContent).toContain("You used your fund for what it's for. Let's rebuild.");
  });

  it('goes to the rebuilt celebration when a rebuild reaches the target again', async () => {
    const adapter = await bakedThenUsed();
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Add to my loaf' }));
    const input = screen.getByLabelText('How much did you move to savings?');
    await user.clear(input);
    await user.type(input, '120');
    await user.click(screen.getByRole('button', { name: 'I moved $120 to savings' }));
    await screen.findByRole('heading', { name: 'You rebuilt your fund.' });
    expect(pathname()).toBe('/loaf-complete');
    expect((await adapter.load()).loaves[0].bakes).toHaveLength(1); // the shelf still has one entry
  });
});

describe('growing mode', () => {
  async function growing() {
    const adapter = await homeAdapter({ target: dollars(200) });
    await deposit(adapter, EF, dollars(200)); // baked at 1 "month"
    await setTarget(adapter, EF, dollars(600), { grow: true });
    await deposit(adapter, EF, dollars(100));
    return adapter;
  }

  it('counts only the new part for the amount, stage and bar, and shows the whole fund separately', async () => {
    mount(await growing());
    await screen.findByText('Shaping · 25% of your new goal');
    expect(screen.getByText('$100')).toBeTruthy();
    expect(screen.getByText('of $400')).toBeTruthy();
    expect(screen.getByText('Whole fund: $300 of $600')).toBeTruthy();
    expect(stageOf()).toBe('shape');
    expect(screen.getByRole('progressbar', { name: 'Progress toward your goal' }).getAttribute('aria-valuenow')).toBe('25');
    expect(screen.queryByText(/Rebuilding/)).toBeNull();
  });

  it('starts the growth as a dough ball without shrinking the fund', async () => {
    const adapter = await homeAdapter({ target: dollars(200) });
    await deposit(adapter, EF, dollars(200));
    await setTarget(adapter, EF, dollars(600), { grow: true });
    mount(adapter);
    await screen.findByText('Mixing · 0% of your new goal');
    expect(screen.getByText('Whole fund: $200 of $600')).toBeTruthy();
    expect(stageOf()).toBe('mix');
  });

  it('ends growing on a withdrawal, and progress goes back to balance over target', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await growing());
    await user.click(await screen.findByRole('button', { name: 'Use my fund' }));
    await user.type(screen.getByLabelText('How much do you need?'), '50');
    await user.click(screen.getByRole('button', { name: 'Use $50 from my fund' }));
    await screen.findByText('Rebuilding · 41% of your goal');
    expect(screen.getByText('$250')).toBeTruthy();
    expect(screen.getByText('of $600')).toBeTruthy();
    expect(screen.queryByText(/^Whole fund/)).toBeNull();
  });
});

describe('tips while it rises', () => {
  it('unlocks by stage, with a New badge until opened', async () => {
    const adapter = await homeAdapter({ starting: dollars(240) }); // proof
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Tips while it rises');

    // Unlocked: shape and proof, both New. Locked: bake and baked, shown but not buttons.
    expect(within(tipButton('Why small deposits add up')).getByText('Unlocked at Shape')).toBeTruthy();
    expect(within(tipButton('Make it automatic')).getByText('Unlocked at Proof')).toBeTruthy();
    expect(screen.getAllByText('New')).toHaveLength(2);
    expect(screen.getByText("When it's the right time to use it").closest('[aria-disabled="true"]')).toBeTruthy();
    expect(screen.getByText('Unlocks at Bake')).toBeTruthy();
    expect(screen.getByText('Choosing your next loaf').closest('[aria-disabled="true"]')).toBeTruthy();
    expect(screen.getByText('Unlocks when your loaf is baked')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /right time to use it/ })).toBeNull();

    // Opening a tip shows it and clears its badge for good.
    await user.click(tipButton('Make it automatic'));
    expect(await screen.findByText(/Set up an automatic transfer in your bank's app/)).toBeTruthy();
    await waitFor(() => expect(within(tipButton('Make it automatic')).queryByText('New')).toBeNull());
    expect(within(tipButton('Make it automatic')).getByText('Read')).toBeTruthy();
    expect(screen.getAllByText('New')).toHaveLength(1);
    expect((await adapter.load()).tipsSeen).toEqual(['emergency-fund:proof']);

    cleanup();
    mount(adapter);
    await screen.findByText('Tips while it rises');
    expect(within(tipButton('Make it automatic')).queryByText('New')).toBeNull();
    expect(within(tipButton('Why small deposits add up')).getByText('New')).toBeTruthy();
  });

  it('has nothing unlocked at the start (the first tip is at Shape)', async () => {
    mount(await homeAdapter());
    await screen.findByText('Tips while it rises');
    expect(screen.queryByText('New')).toBeNull();
    expect(screen.getAllByText(/^Unlocks/)).toHaveLength(4);
  });
});

describe('high-yield savings reminder', () => {
  const title = 'Open a high-yield savings account';

  it('shows after "I\'ll do this later" with the what-to-look-for points, and can be dismissed', async () => {
    const adapter = await homeAdapter({ accountList: ['checking'], hysaCard: 'pending' });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    const card = await screen.findByRole('region', { name: title });
    expect(within(card).getByRole('heading', { name: title })).toBeTruthy();
    expect(within(card).getByText('Insured by the FDIC (banks) or the NCUA (credit unions)')).toBeTruthy();
    expect(within(card).getByText('Low or no fees')).toBeTruthy();

    await user.click(within(card).getByRole('button', { name: 'Dismiss this reminder' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: title })).toBeNull());
    expect((await adapter.load()).hysaCard).toBe('dismissed');
    cleanup();
    mount(adapter);
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.queryByRole('region', { name: title })).toBeNull();
  });

  it('"I have one now" works the same as in saving setup: adds the account to the profile and clears the card', async () => {
    const adapter = await homeAdapter({ accountList: ['checking'], hysaCard: 'pending' });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    const card = await screen.findByRole('region', { name: title });
    await user.click(within(card).getByRole('button', { name: 'I have one now' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: title })).toBeNull());
    const data = await adapter.load();
    expect(data.profile?.accounts).toEqual(['checking', 'high-yield-savings']);
    expect(data.hysaCard).toBeNull();
  });

  it('does not show without a pending reminder, or when the student already has a savings account', async () => {
    mount(await homeAdapter({ accountList: ['checking'], hysaCard: null }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.queryByRole('region', { name: title })).toBeNull();
    cleanup();
    mount(await homeAdapter({ accountList: ['checking', 'high-yield-savings'], hysaCard: 'pending' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.queryByRole('region', { name: title })).toBeNull();
  });
});
