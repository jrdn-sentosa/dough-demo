// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import { BreadPicker } from '../components/BreadPicker';
import { UnlockMoment } from '../components/UnlockMoment';
import { getBreads } from '../content/loader';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { saveRisk } from '../data/profile';
import { syncStreaks } from '../data/streaks';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import type { UnlockableBread } from '../domain/breads';
import { profileFromAnswers } from '../domain/profile';
import type { PlacementAnswers } from '../domain/placement';
import { skipWeek } from '../money/demo';
import { deposit, getLoafStatus, startLoaf } from '../money/ledger';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;
const MONTH = dollars(400);
const user = { email: 'a@b.co' };
const breads = getBreads();

const answers: PlacementAnswers = {
  essentials: '250-499',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

const quizAttempt: QuizAttempt = { id: 'quiz-1', loafId: EF, mode: 'lesson', score: 2, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };

/** A returning student with a weekly habit and a $4,000 fund that is still rising. */
async function risingAdapter(): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(answers), quizAttempts: [quizAttempt] });
  await startLoaf(adapter, EF, dollars(4000));
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
  return adapter;
}

/** A student whose one-month fund has baked, with the given breads already unlocked (and seen). */
async function bakedAdapter(unlocked: UnlockableBread[] = []): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(answers), quizAttempts: [quizAttempt] });
  await startLoaf(adapter, EF, MONTH);
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
  await deposit(adapter, EF, MONTH);
  const data = await adapter.load();
  data.streaks.unlocked = unlocked.map((bread) => ({ bread, at: '2026-01-01T00:00:00.000Z', seen: true }));
  await adapter.save(data);
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

describe('Home streak card and unlock moment', () => {
  it('shows "No streak yet" and the first bread to work toward', async () => {
    mount(await risingAdapter());
    const card = await screen.findByRole('region', { name: 'Your streak' });
    expect(within(card).getByText('No streak yet')).toBeTruthy();
    expect(within(card).getByText('Baguette unlocks at 2 weeks of saving.')).toBeTruthy();
    expect(screen.queryByText('Baguette unlocked')).toBeNull();
  });

  it('after two weeks of saving, shows the streak, the unlock moment, and what is next', async () => {
    const adapter = await risingAdapter();
    await skipWeek(adapter, EF);
    await skipWeek(adapter, EF);
    mount(adapter);
    expect(await screen.findByText('Baguette unlocked')).toBeTruthy();
    expect(screen.getByText('You can pick it for your next loaf.')).toBeTruthy();
    const card = screen.getByRole('region', { name: 'Your streak' });
    expect(within(card).getByText('2-week streak')).toBeTruthy();
    expect(within(card).getByText('Baguette unlocked. Bagel next at 4 weeks.')).toBeTruthy();
  });

  it('dismissing the unlock moment is remembered and does not take the bread away', async () => {
    const adapter = await risingAdapter();
    await skipWeek(adapter, EF);
    await skipWeek(adapter, EF);
    const user = userEvent.setup();
    mount(adapter);
    await screen.findByText('Baguette unlocked');
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await waitFor(() => expect(screen.queryByText('Baguette unlocked')).toBeNull());
    const data = await adapter.load();
    expect(data.streaks.unlocked).toMatchObject([{ bread: 'baguette', seen: true }]);
  });

  it('a streak that starts over reads as a fresh start and keeps the unlock', async () => {
    const adapter = await risingAdapter();
    await skipWeek(adapter, EF);
    await skipWeek(adapter, EF);
    await syncStreaks(adapter);
    const data = await adapter.load();
    data.streaks.unlocked[0].seen = true;
    data.clock.offsetDays += 28;
    await adapter.save(data);
    mount(adapter);
    const card = await screen.findByRole('region', { name: 'Your streak' });
    expect(within(card).getByText('New streak starts now.')).toBeTruthy();
    expect(within(card).getByText(/Your unlocked breads stay yours/)).toBeTruthy();
    expect(card.textContent).not.toMatch(/lost|broke|failed/i);
    expect((await adapter.load()).streaks.unlocked).toHaveLength(1);
  });

  it('shows the demo tools only in demo mode, and Skip a week builds the streak', async () => {
    const adapter = await risingAdapter();
    mount(adapter);
    await screen.findByRole('region', { name: 'Your streak' });
    expect(screen.queryByRole('button', { name: 'Skip a week' })).toBeNull();
    cleanup();

    sessionStorage.setItem('dough.demo', '1');
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Skip a week' }));
    await waitFor(async () => expect((await adapter.load()).transactions).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Skip a week' }));
    expect(await screen.findByText('Baguette unlocked')).toBeTruthy();
  });

  it('Skip a week without saving only moves the clock', async () => {
    sessionStorage.setItem('dough.demo', '1');
    const adapter = await risingAdapter();
    const user = userEvent.setup();
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Skip a week without saving' }));
    await waitFor(async () => expect((await adapter.load()).clock.offsetDays).toBe(7));
    expect((await adapter.load()).transactions).toEqual([]);
  });
});

describe('UnlockMoment', () => {
  it('names the bread, says it can be picked, and dismisses', async () => {
    let dismissed = 0;
    render(<UnlockMoment bread="pretzel" copy={breads} onDismiss={() => (dismissed += 1)} />);
    expect(screen.getByText('Pretzel unlocked')).toBeTruthy();
    expect(document.querySelector('img')?.getAttribute('aria-hidden')).toBe('true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(dismissed).toBe(1);
  });
});

describe('BreadPicker', () => {
  const pick = (value: 'sandwich' | 'baguette' = 'sandwich', onChange: (b: string) => void = () => {}) =>
    render(
      <BreadPicker
        copy={breads}
        available={['sandwich', 'baguette']}
        value={value}
        onChange={onChange}
        weeksLeft={(b) => (b === 'bagel' ? 1 : b === 'sandwich' || b === 'baguette' ? 0 : 6)}
      />,
    );

  it('lists every bread as a radio: the default and unlocked open, the rest locked with weeks left', () => {
    pick();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(7);
    expect(radios.filter((r) => r.disabled)).toHaveLength(5);
    expect(screen.getByRole('radio', { name: /Sandwich loaf.*Default/ })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /Baguette.*Unlocked/ })).toBeTruthy();
    expect((screen.getByRole('radio', { name: /Bagel.*1 more week/ }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('radio', { name: /Croissant.*6 more weeks/ }) as HTMLInputElement).disabled).toBe(true);
  });

  it('selects the open bread and ignores a locked one', async () => {
    const picked: string[] = [];
    pick('sandwich', (b) => picked.push(b));
    const user = userEvent.setup();
    await user.click(screen.getByRole('radio', { name: /Baguette/ }));
    await user.click(screen.getByRole('radio', { name: /Bagel/ }));
    expect(picked).toEqual(['baguette']);
  });

  it('keeps the art decorative', () => {
    pick();
    for (const img of document.querySelectorAll('img')) expect(img.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('bread step on Choose your next loaf', () => {
  it('goes straight to Home, in the default bread, when nothing beyond the default is unlocked', async () => {
    const adapter = await bakedAdapter();
    const user = userEvent.setup();
    const { pathname } = mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    await waitFor(() => expect(pathname()).toBe('/'));
    expect(screen.queryByText('Pick a bread')).toBeNull();
    expect((await getLoafStatus(adapter, EF))?.bread).toBe('sandwich');
  });

  it('asks which bread when one is unlocked, and grows in the one picked', async () => {
    const adapter = await bakedAdapter(['baguette']);
    const user = userEvent.setup();
    const { pathname } = mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pick a bread' });
    expect((within(dialog).getByRole('radio', { name: /Sandwich loaf/ }) as HTMLInputElement).checked).toBe(true);
    expect(within(dialog).getByRole('button', { name: 'Grow in Sandwich loaf' })).toBeTruthy();
    expect((within(dialog).getByRole('radio', { name: /Bagel/ }) as HTMLInputElement).disabled).toBe(true);

    await user.click(within(dialog).getByRole('radio', { name: /Baguette/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Grow in Baguette' }));
    await waitFor(() => expect(pathname()).toBe('/'));
    expect(await getLoafStatus(adapter, EF)).toMatchObject({ bread: 'baguette', growing: true, targetCents: MONTH * 3 });
  });

  it('Back closes the step without changing the loaf', async () => {
    const adapter = await bakedAdapter(['baguette']);
    const user = userEvent.setup();
    const { pathname } = mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Pick a bread' })).getByRole('button', { name: 'Back' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(pathname()).toBe('/choose-loaf');
    expect(await getLoafStatus(adapter, EF)).toMatchObject({ bread: 'sandwich', growing: false });
  });

  it('asks for essentials after the bread when they are unknown, and keeps the bread', async () => {
    const adapter = createMemoryAdapter({
      ...emptyData(),
      user,
      profile: profileFromAnswers({ ...answers, essentials: 'not-sure' }),
      quizAttempts: [quizAttempt],
    });
    await startLoaf(adapter, EF, dollars(1000));
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    await deposit(adapter, EF, dollars(1000));
    const data = await adapter.load();
    data.streaks.unlocked = [{ bread: 'bagel', at: '2026-01-01T00:00:00.000Z', seen: true }];
    await adapter.save(data);

    const user2 = userEvent.setup();
    const { pathname } = mount(adapter, '/choose-loaf');
    await user2.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pick a bread' });
    await user2.click(within(dialog).getByRole('radio', { name: /Bagel/ }));
    await user2.click(within(dialog).getByRole('button', { name: 'Grow in Bagel' }));
    await user2.type(await screen.findByLabelText('About how much do you need each month?'), '500');
    await user2.click(screen.getByRole('button', { name: 'Set my goal' }));
    await waitFor(() => expect(pathname()).toBe('/'));
    expect(await getLoafStatus(adapter, EF)).toMatchObject({ bread: 'bagel', growing: true, targetCents: dollars(1500) });
  });
});

describe('bread step on the risk result', () => {
  it('shows the bread step before growing from "keep it in savings"', async () => {
    const adapter = await bakedAdapter(['baguette', 'bagel']);
    await saveRisk(adapter, { horizon: 'within-year', drop: 'add-more', priority: 'growth', experience: 'yes' });
    const user = userEvent.setup();
    const { pathname } = mount(adapter, '/risk-result');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pick a bread' });
    await user.click(within(dialog).getByRole('radio', { name: /Bagel/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Grow in Bagel' }));
    await waitFor(() => expect(pathname()).toBe('/'));
    expect((await getLoafStatus(adapter, EF))?.bread).toBe('bagel');
  });
});

describe('bread step on Your new loaf', () => {
  async function newLoafAdapter(unlocked: UnlockableBread[]): Promise<DataAdapter> {
    const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers({ ...answers, savings: 'none' }) });
    const data = await adapter.load();
    data.streaks.unlocked = unlocked.map((bread) => ({ bread, at: '2026-01-01T00:00:00.000Z', seen: true }));
    await adapter.save(data);
    return adapter;
  }

  it('has no picker when only the default bread is available', async () => {
    mount(await newLoafAdapter([]), '/new-loaf');
    await screen.findByRole('button', { name: 'Start my loaf' });
    expect(screen.queryByText('Pick a bread')).toBeNull();
  });

  it('shows the picker when a bread is unlocked, and starts the loaf in the one picked', async () => {
    const adapter = await newLoafAdapter(['baguette']);
    const user = userEvent.setup();
    mount(adapter, '/new-loaf');
    expect(await screen.findByText('Pick a bread')).toBeTruthy();
    await user.click(screen.getByRole('radio', { name: /Baguette/ }));
    await user.click(screen.getByRole('button', { name: 'Start my loaf' }));
    await waitFor(async () => expect((await adapter.load()).loaves).toHaveLength(1));
    expect((await adapter.load()).loaves[0].bread).toBe('baguette');
  });

  it('starts in the default bread when the picker is left alone', async () => {
    const adapter = await newLoafAdapter(['baguette']);
    const user = userEvent.setup();
    mount(adapter, '/new-loaf');
    await user.click(await screen.findByRole('button', { name: 'Start my loaf' }));
    await waitFor(async () => expect((await adapter.load()).loaves).toHaveLength(1));
    expect((await adapter.load()).loaves[0].bread).toBe('sandwich');
  });
});
