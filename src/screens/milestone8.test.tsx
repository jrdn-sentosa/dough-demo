// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import { getLoaf } from '../content/loader';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { saveRisk } from '../data/profile';
import { emptyData } from '../data/types';
import type { Bake, QuizAttempt } from '../data/types';
import type { PlacementAnswers } from '../domain/placement';
import { profileFromAnswers } from '../domain/profile';
import { addStarting, deposit, setTarget, startLoaf, withdraw } from '../money/ledger';
import { bakeLabel, bakeMonth, bakeSize } from './Shelf/labels';

afterEach(cleanup);

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;
const user = { email: 'a@b.co' };
/** Essentials in the 250-499 band work out to $400 a month, so 1 month is $400, 3 months $1,200, 6 months $2,400. */
const MONTH = dollars(400);

const baseAnswers: PlacementAnswers = {
  essentials: '250-499',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

function quizAttempt(score: number): QuizAttempt {
  return { id: 'quiz-1', loafId: EF, mode: 'lesson', score, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };
}

interface Fund {
  /** How many months of essentials the baked fund covered. */
  months?: 1 | 3 | 6;
  answers?: PlacementAnswers;
  mastered?: boolean;
  /** Raw target in cents, for a fund that isn't a whole number of months (or has unknown essentials). */
  targetCents?: number;
}

/** A student whose emergency fund has just baked, built through the money layer. */
async function bakedAdapter({ months = 1, answers = baseAnswers, mastered = false, targetCents }: Fund = {}): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user,
    profile: profileFromAnswers(answers),
    quizAttempts: [quizAttempt(mastered ? 4 : 2)],
  });
  const target = targetCents ?? MONTH * months;
  await startLoaf(adapter, EF, target);
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
  await deposit(adapter, EF, target);
  return adapter;
}

type Entry = string | { pathname: string; state?: unknown };

function mount(adapter: DataAdapter, entry: Entry = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [entry] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { router, pathname: () => router.state.location.pathname, search: () => router.state.location.search };
}

const loafButtons = () => document.querySelectorAll('.loaf-button');

describe('celebration', () => {
  it('first bake: "Your loaf is baked!" with what they saved, the tagline and both buttons', async () => {
    mount(await bakedAdapter(), '/loaf-complete');
    await screen.findByRole('heading', { name: 'Your loaf is baked!' });
    expect(screen.getByText("You saved $400 for emergencies. That's a real cushion.")).toBeTruthy();
    expect(screen.getByText('Stack that bread.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose my next loaf' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'See my bread shelf' })).toBeTruthy();
    expect(loafButtons()).toHaveLength(1);
  });

  it('rebuilt: "You rebuilt your fund."', async () => {
    mount(await bakedAdapter(), { pathname: '/loaf-complete', state: { rebuilt: true } });
    await screen.findByRole('heading', { name: 'You rebuilt your fund.' });
    expect(screen.getByText("It's back to $400, ready for the next surprise.")).toBeTruthy();
  });

  it('grown: "Your cushion is at 3 months."', async () => {
    const adapter = await bakedAdapter();
    await setTarget(adapter, EF, MONTH * 3, { grow: true });
    await deposit(adapter, EF, MONTH * 2);
    mount(adapter, { pathname: '/loaf-complete', state: { grown: true } });
    await screen.findByRole('heading', { name: 'Your cushion is at 3 months.' });
    expect(screen.getByText("That's $1,200 set aside. Seriously impressive.")).toBeTruthy();
  });

  it('grown with unknown essentials has no months figure to quote', async () => {
    const adapter = await bakedAdapter({ answers: { ...baseAnswers, essentials: 'not-sure' }, targetCents: dollars(1000) });
    await setTarget(adapter, EF, dollars(2400), { grow: true });
    await deposit(adapter, EF, dollars(1400));
    mount(adapter, { pathname: '/loaf-complete', state: { grown: true } });
    await screen.findByRole('heading', { name: 'Your cushion just grew.' });
    expect(screen.getByText("That's $2,400 set aside. Seriously impressive.")).toBeTruthy();
  });

  it('falls back to the first-bake copy after a reload, when the navigation state is gone', async () => {
    mount(await bakedAdapter(), '/loaf-complete');
    await screen.findByRole('heading', { name: 'Your loaf is baked!' });
  });

  it('adds the golden finish, sparkles and a pill when the lessons are mastered', async () => {
    mount(await bakedAdapter({ mastered: true }), '/loaf-complete');
    await screen.findByText('Baked with mastered lessons');
    expect(document.querySelector('.golden-finish')).toBeTruthy();
    expect(document.querySelector('.golden-finish path[fill="#F6C453"]')).toBeTruthy();
  });

  it('is the same baked loaf without the golden finish or pill when they are not mastered', async () => {
    mount(await bakedAdapter({ mastered: false }), '/loaf-complete');
    await screen.findByRole('heading', { name: 'Your loaf is baked!' });
    expect(screen.queryByText('Baked with mastered lessons')).toBeNull();
    expect(document.querySelector('.golden-finish')).toBeNull();
    expect(document.querySelector('.baked-loaf img')).toBeTruthy();
  });

  it('enters with a gentle scale and settling confetti, all decorative', async () => {
    mount(await bakedAdapter(), '/loaf-complete');
    await screen.findByRole('heading', { name: 'Your loaf is baked!' });
    const stage = document.querySelector('.celebrate__stage');
    expect(stage?.getAttribute('aria-hidden')).toBe('true');
    expect(stage?.querySelector('.celebrate__loaf')).toBeTruthy();
    expect(stage?.querySelectorAll('.confetti').length).toBeGreaterThan(4);
  });

  it('goes on to the choices or the shelf', async () => {
    const user = userEvent.setup({ delay: null });
    const a = mount(await bakedAdapter(), '/loaf-complete');
    await user.click(await screen.findByRole('button', { name: 'Choose my next loaf' }));
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(a.pathname()).toBe('/choose-loaf');
    cleanup();
    const b = mount(await bakedAdapter(), '/loaf-complete');
    await user.click(await screen.findByRole('button', { name: 'See my bread shelf' }));
    await screen.findByRole('heading', { name: 'Your bread shelf' });
    expect(b.pathname()).toBe('/shelf');
  });
});

describe('bread shelf', () => {
  it('shows a grown fund as two entries, "1 month" and "3 months", newest last', async () => {
    const adapter = await bakedAdapter();
    await setTarget(adapter, EF, MONTH * 3, { grow: true });
    await deposit(adapter, EF, MONTH * 2);
    mount(adapter, '/shelf');
    await screen.findByRole('heading', { name: 'Your bread shelf' });
    const baked = screen.getByRole('region', { name: 'Baked' });
    const items = within(baked).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0].textContent).toMatch(/Emergency fund1 month · [A-Z][a-z]{2} \d{4}/);
    expect(items[1].textContent).toMatch(/Emergency fund3 months · [A-Z][a-z]{2} \d{4}/);
    expect(screen.getByText('Emergency fund total').parentElement?.textContent).toContain('$1,200');
  });

  it('says "Already built" with no date for a fund that was baked at the start', async () => {
    const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(baseAnswers) });
    await startLoaf(adapter, EF, MONTH);
    await addStarting(adapter, EF, MONTH + dollars(50));
    mount(adapter, '/shelf');
    const baked = await screen.findByRole('region', { name: 'Baked' });
    const [item] = within(baked).getAllByRole('listitem');
    expect(item.textContent).toContain('1 month · Already built');
    expect(item.textContent).not.toMatch(/\d{4}/);
  });

  it('shows the amount when the essentials are unknown, so months cannot be worked out', async () => {
    mount(await bakedAdapter({ answers: { ...baseAnswers, essentials: 'not-sure' }, targetCents: dollars(1000) }), '/shelf');
    const baked = await screen.findByRole('region', { name: 'Baked' });
    expect(within(baked).getAllByRole('listitem')[0].textContent).toMatch(/\$1,000 · [A-Z][a-z]{2} \d{4}/);
  });

  it('puts the upcoming loaves as dashed outlines marked Coming soon, not buttons', async () => {
    mount(await bakedAdapter(), '/shelf');
    const soon = await screen.findByRole('region', { name: 'Coming soon' });
    const items = within(soon).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual(['Index fundsComing soon', 'BondsComing soon', 'Roth IRAComing soon']);
    expect(within(soon).queryByRole('button')).toBeNull();
    expect(soon.querySelectorAll('img.outline-loaf')).toHaveLength(3);
  });

  it('gives mastered loaves the golden finish, and goes back to the loaf', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await bakedAdapter({ mastered: true }), '/shelf');
    await screen.findByRole('heading', { name: 'Your bread shelf' });
    expect(document.querySelectorAll('.shelf .golden-finish')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Back to my loaf' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
  });

  it('stays open while rebuilding, with the loaf it already baked', async () => {
    const adapter = await bakedAdapter();
    await withdraw(adapter, EF, dollars(100));
    mount(adapter, '/shelf');
    const baked = await screen.findByRole('region', { name: 'Baked' });
    expect(within(baked).getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('shelf labels', () => {
  const copy = getLoaf(EF);
  if (copy.status !== 'built') throw new Error('built loaf expected');
  const shelf = copy.flow.shelf;
  const bake = (targetCents: number, at: string | null): Bake => ({ targetCents, at, bread: 'sandwich' });

  it('works months out from the target and the essentials', () => {
    expect(bakeSize(bake(MONTH, null), MONTH, shelf)).toBe('1 month');
    expect(bakeSize(bake(MONTH * 3, null), MONTH, shelf)).toBe('3 months');
    expect(bakeSize(bake(MONTH * 6, null), MONTH, shelf)).toBe('6 months');
  });

  it('falls back to the amount without essentials, or for a custom goal that is not whole months', () => {
    expect(bakeSize(bake(dollars(1000), null), null, shelf)).toBe('$1,000');
    expect(bakeSize(bake(dollars(500), null), MONTH, shelf)).toBe('$500');
    expect(bakeSize(bake(dollars(100), null), MONTH, shelf)).toBe('$100');
  });

  it('labels a dated bake with the month and year, and an Already built bake with no date', () => {
    const at = '2026-10-15T12:00:00.000Z';
    expect(bakeLabel(bake(MONTH, at), MONTH, shelf).sub).toBe(`1 month · ${bakeMonth(at)}`);
    expect(bakeMonth(at)).toBe('Oct 2026');
    expect(bakeLabel(bake(MONTH, null), MONTH, shelf).sub).toBe('1 month · Already built');
  });
});

describe('Home: the shelf link and the next loaf', () => {
  it('links to the bread shelf', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await bakedAdapter(), '/');
    await user.click(await screen.findByRole('link', { name: 'Bread shelf' }));
    await screen.findByRole('heading', { name: 'Your bread shelf' });
    expect(pathname()).toBe('/shelf');
  });

  it('offers "Choose my next loaf" once the loaf is baked, as the one loaf button', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await bakedAdapter(), '/');
    await user.click(await screen.findByRole('button', { name: 'Choose my next loaf' }));
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(pathname()).toBe('/choose-loaf');
  });

  it('does not offer it while the loaf is still rising, rebuilding or growing', async () => {
    const rising = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(baseAnswers), quizAttempts: [quizAttempt(2)] });
    await startLoaf(rising, EF, MONTH);
    await saveHabit(rising, { kind: 'weekly', amountCents: dollars(35) });
    mount(rising, '/');
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(screen.queryByRole('button', { name: 'Choose my next loaf' })).toBeNull();
    cleanup();

    const rebuilding = await bakedAdapter();
    await withdraw(rebuilding, EF, dollars(100));
    mount(rebuilding, '/');
    await screen.findByText(/^Rebuilding/);
    expect(screen.queryByRole('button', { name: 'Choose my next loaf' })).toBeNull();
    cleanup();

    const growing = await bakedAdapter();
    await setTarget(growing, EF, MONTH * 3, { grow: true });
    mount(growing, '/');
    await screen.findByText(/^Whole fund/);
    expect(screen.queryByRole('button', { name: 'Choose my next loaf' })).toBeNull();
  });

  it('puts the golden finish on the baked loaf when the lessons are mastered', async () => {
    mount(await bakedAdapter({ mastered: true }), '/');
    await screen.findByText('Baked · 100% of your goal');
    expect(document.querySelector('.loaf-art .golden-finish')).toBeTruthy();
    cleanup();
    mount(await bakedAdapter({ mastered: false }), '/');
    await screen.findByText('Baked · 100% of your goal');
    expect(document.querySelector('.loaf-art .golden-finish')).toBeNull();
  });

  it('keeps the golden finish off a loaf that is not baked yet', async () => {
    const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(baseAnswers), quizAttempts: [quizAttempt(4)] });
    await startLoaf(adapter, EF, MONTH);
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    await deposit(adapter, EF, dollars(300));
    mount(adapter, '/');
    await screen.findByText('Baking · 75% of your goal');
    expect(document.querySelector('.golden-finish')).toBeNull();
  });
});

describe('Choose your next loaf', () => {
  const recommended = () => screen.queryByRole('region', { name: 'Recommended' });

  it('under 3 months: Keep saving is recommended with the loaf button, and investing is a slice button', async () => {
    mount(await bakedAdapter({ months: 1 }), '/choose-loaf');
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    const rec = recommended();
    expect(rec).toBeTruthy();
    expect(within(rec as HTMLElement).getByRole('heading', { name: 'Grow your cushion to 3 months' })).toBeTruthy();
    expect(within(rec as HTMLElement).getByText('Recommended')).toBeTruthy();
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(within(rec as HTMLElement).getByRole('button', { name: 'Grow my cushion' }).className).toContain('loaf-button');
    expect(screen.getByRole('button', { name: 'Start investing' }).className).toContain('slice-button');
    expect(loafButtons()).toHaveLength(1);
  });

  it('lists the four other loaves as Coming soon rows that are not buttons', async () => {
    mount(await bakedAdapter(), '/choose-loaf');
    const more = await screen.findByRole('region', { name: 'More loaves' });
    for (const [title, bread] of [
      ['Debt payoff', 'Flatbread'],
      ['Index funds', 'Braided loaf'],
      ['Bonds', 'Rye loaf'],
      ['Roth IRA', 'Sourdough'],
    ]) {
      const row = within(more).getByText(title).closest('.option') as HTMLElement;
      expect(row.textContent).toContain(bread);
      expect(within(row).getByText('Coming soon')).toBeTruthy();
      expect(within(row).queryByRole('button')).toBeNull();
    }
    expect(within(more).getAllByText('Coming soon')).toHaveLength(4);
    // Debt payoff leads, as in the mockup.
    expect(more.querySelector('.option .option__title')?.textContent).toBe('Debt payoff');
  });

  it('Grow my cushion grows the same loaf to 3 months and goes to Home as a new dough ball', async () => {
    const adapter = await bakedAdapter({ months: 1 });
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    await screen.findByText('Mixing · 0% of your new goal');
    expect(pathname()).toBe('/');
    const loaf = (await adapter.load()).loaves[0];
    expect(loaf).toMatchObject({ targetCents: MONTH * 3, growFromCents: MONTH });
    expect(loaf.bakes).toHaveLength(1);
    expect(screen.getByText('Whole fund: $400 of $1,200')).toBeTruthy();
  });

  it('with unknown essentials, asks for them first, then sets 3 times the answer', async () => {
    const adapter = await bakedAdapter({ answers: { ...baseAnswers, essentials: 'not-sure' }, targetCents: dollars(1000) });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    expect(screen.getByText('To size your 3-month goal, about how much do you need each month?')).toBeTruthy();
    const input = screen.getByLabelText('About how much do you need each month?');
    await user.type(input, 'abc');
    expect((screen.getByRole('button', { name: 'Set my goal' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe('Enter a dollar amount, like 800.');
    await user.clear(input);
    await user.type(input, '800');
    await user.click(screen.getByRole('button', { name: 'Set my goal' }));
    await screen.findByText(/^Whole fund/);
    const data = await adapter.load();
    expect(data.loaves[0]).toMatchObject({ targetCents: dollars(2400), growFromCents: dollars(1000) });
    expect(data.profile?.essentialsCents).toBe(dollars(800));
  });

  it('shows the money layer\'s message if the new goal is not bigger than the old one', async () => {
    const adapter = await bakedAdapter({ answers: { ...baseAnswers, essentials: 'not-sure' }, targetCents: dollars(1000) });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    await user.type(screen.getByLabelText('About how much do you need each month?'), '100');
    await user.click(screen.getByRole('button', { name: 'Set my goal' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Pick a goal bigger than your current one.');
    expect((await adapter.load()).loaves[0].growFromCents).toBeNull();
  });

  it('cancelling the essentials question changes nothing', async () => {
    const adapter = await bakedAdapter({ answers: { ...baseAnswers, essentials: 'not-sure' }, targetCents: dollars(1000) });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Grow my cushion' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect((await adapter.load()).loaves[0].targetCents).toBe(dollars(1000));
  });

  it('at 3 months, Start investing is recommended and "Grow to 6 months" is offered, never recommended', async () => {
    const adapter = await bakedAdapter({ months: 3 });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/choose-loaf');
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    const rec = recommended() as HTMLElement;
    expect(within(rec).getByRole('heading', { name: 'Start investing' })).toBeTruthy();
    expect(within(rec).getByRole('button', { name: 'Start investing' }).className).toContain('loaf-button');
    expect(screen.getAllByText('Recommended')).toHaveLength(1);
    expect(within(rec).queryByText('Grow to 6 months')).toBeNull();
    const six = screen.getByRole('button', { name: 'Grow to 6 months' });
    expect(six.className).toContain('slice-button');
    expect(screen.queryByRole('heading', { name: 'Grow your cushion to 3 months' })).toBeNull();
    expect(loafButtons()).toHaveLength(1);

    await user.click(six);
    await screen.findByText(/^Whole fund/);
    expect((await adapter.load()).loaves[0]).toMatchObject({ targetCents: MONTH * 6, growFromCents: MONTH * 3 });
  });

  it('at 6 months or more, only Start investing is offered', async () => {
    mount(await bakedAdapter({ months: 6 }), '/choose-loaf');
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(screen.queryByRole('button', { name: /Grow/ })).toBeNull();
    expect(within(recommended() as HTMLElement).getByRole('button', { name: 'Start investing' })).toBeTruthy();
  });

  it('Start investing goes straight to the risk quiz when there is no card debt', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await bakedAdapter({ months: 3 }), '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Start investing' }));
    await screen.findByText("Let's see what fits");
    expect(pathname()).toBe('/risk-quiz');
  });

  describe('with card debt', () => {
    const debt = { ...baseAnswers, cardDebt: 'yes' } as const;

    it('at 3 months or more: no path is recommended, and Start investing leads with the debt note', async () => {
      const user = userEvent.setup({ delay: null });
      const { pathname } = mount(await bakedAdapter({ months: 3, answers: debt }), '/choose-loaf');
      await user.click(await screen.findByRole('button', { name: 'Start investing' }));
      expect(screen.queryByText('Recommended')).toBeNull();
      expect(await screen.findByText('Paying off high-interest debt usually comes before investing.')).toBeTruthy();
      expect(pathname()).toBe('/choose-loaf');
    });

    it('shows no Recommended pill at all, but the choices stay', async () => {
      mount(await bakedAdapter({ months: 3, answers: debt }), '/choose-loaf');
      await screen.findByRole('heading', { name: 'Choose your next loaf' });
      expect(screen.queryByText('Recommended')).toBeNull();
      expect(screen.getByRole('button', { name: 'Start investing' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Grow to 6 months' })).toBeTruthy();
    });

    it('"Continue anyway" goes on to the risk quiz, with Debt payoff marked Coming soon and not a button', async () => {
      const user = userEvent.setup({ delay: null });
      const { pathname } = mount(await bakedAdapter({ months: 3, answers: debt }), '/choose-loaf');
      await user.click(await screen.findByRole('button', { name: 'Start investing' }));
      await screen.findByText('Paying off high-interest debt usually comes before investing.');
      const row = screen.getByText('Debt payoff').closest('.option') as HTMLElement;
      expect(within(row).getByText('Coming soon')).toBeTruthy();
      expect(within(row).queryByRole('button')).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Continue anyway' }));
      await screen.findByText("Let's see what fits");
      expect(pathname()).toBe('/risk-quiz');
    });

    it('"Back" returns to the choices', async () => {
      const user = userEvent.setup({ delay: null });
      mount(await bakedAdapter({ months: 3, answers: debt }), '/choose-loaf');
      await user.click(await screen.findByRole('button', { name: 'Start investing' }));
      await user.click(await screen.findByRole('button', { name: 'Back' }));
      await screen.findByRole('heading', { name: 'Choose your next loaf' });
    });

    it('under 3 months: Keep saving is still recommended, and investing still shows the debt note first', async () => {
      const user = userEvent.setup({ delay: null });
      mount(await bakedAdapter({ months: 1, answers: debt }), '/choose-loaf');
      await screen.findByRole('heading', { name: 'Choose your next loaf' });
      expect(within(recommended() as HTMLElement).getByRole('heading', { name: 'Grow your cushion to 3 months' })).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Start investing' }));
      await screen.findByText('Paying off high-interest debt usually comes before investing.');
    });
  });

  describe('with card debt unknown', () => {
    const unknown: PlacementAnswers = { essentials: '250-499', accounts: ['checking'], earnedIncome: true };

    it('replaces the recommendation with the personalization prompt, and both paths stay choosable', async () => {
      mount(await bakedAdapter({ months: 3, answers: unknown }), '/choose-loaf');
      await screen.findByRole('heading', { name: 'Choose your next loaf' });
      expect(screen.getByText('Answer a few quick questions for a personalized pick')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Personalize' }).className).toContain('loaf-button');
      expect(screen.queryByText('Recommended')).toBeNull();
      expect(loafButtons()).toHaveLength(1);
      expect(screen.getByRole('button', { name: 'Start investing' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Grow to 6 months' })).toBeTruthy();
    });

    it('Personalize opens placement as a retake that returns here', async () => {
      const user = userEvent.setup({ delay: null });
      const { pathname, search } = mount(await bakedAdapter({ months: 3, answers: unknown }), '/choose-loaf');
      await user.click(await screen.findByRole('button', { name: 'Personalize' }));
      await screen.findByText('Update your answers');
      expect(pathname()).toBe('/placement');
      expect(search()).toBe('?retake=1&return=/choose-loaf');
    });

    it('Start investing never skips the debt check: it asks the question first', async () => {
      const user = userEvent.setup({ delay: null });
      const { pathname, search } = mount(await bakedAdapter({ months: 3, answers: unknown }), '/choose-loaf');
      await user.click(await screen.findByRole('button', { name: 'Start investing' }));
      await screen.findByText('Update your answers');
      expect(pathname()).toBe('/placement');
      expect(search()).toContain('retake=1');
    });

    it('Keep saving under 3 months still works with everything unknown', async () => {
      mount(await bakedAdapter({ months: 1, answers: unknown }), '/choose-loaf');
      await screen.findByRole('heading', { name: 'Choose your next loaf' });
      expect(within(recommended() as HTMLElement).getByRole('heading', { name: 'Grow your cushion to 3 months' })).toBeTruthy();
      expect(screen.queryByText('Answer a few quick questions for a personalized pick')).toBeNull();
    });
  });

  it('"Not now" goes back to the loaf', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await bakedAdapter(), '/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Not now, back to my loaf' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
  });

  it('is closed to a loaf that has not baked', async () => {
    const adapter = createMemoryAdapter({ ...emptyData(), user, profile: profileFromAnswers(baseAnswers), quizAttempts: [quizAttempt(2)] });
    await startLoaf(adapter, EF, MONTH);
    await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
    const { pathname } = mount(adapter, '/choose-loaf');
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
  });
});

describe('placement retake (Personalize)', () => {
  const unknownDebt: PlacementAnswers = { essentials: '250-499', accounts: ['checking'], earnedIncome: true };

  it('fills in the current answers, skips the savings question, and returns to the choices with the debt answer saved', async () => {
    const adapter = await bakedAdapter({ months: 3, answers: unknownDebt });
    await saveRisk(adapter, { horizon: 'over-five' });
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter, '/placement?retake=1&return=/choose-loaf');

    // Question 1: essentials, prefilled.
    await screen.findByText('Update your answers');
    expect((screen.getByRole('radio', { name: '$250–$499' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // The existing-savings question is skipped: that money is already tracked. Accounts come next.
    expect(await screen.findByRole('checkbox', { name: 'Checking account' })).toBeTruthy();
    expect((screen.getByRole('checkbox', { name: 'Checking account' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Card debt was never answered: nothing is selected, so Next waits.
    await screen.findByText(/credit card balance/);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    // Earned income, prefilled, is the last question.
    expect((await screen.findByRole('radio', { name: 'Yes' }) as HTMLInputElement).checked).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Save my answers' }));

    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(pathname()).toBe('/choose-loaf');
    const data = await adapter.load();
    expect(data.profile?.cardDebt).toBe('no');
    expect(data.profile?.risk?.answers).toEqual({ horizon: 'over-five' });
    expect(data.transactions).toHaveLength(1);
    // Now that the debt answer is known, investing is recommended.
    expect(screen.queryByText('Answer a few quick questions for a personalized pick')).toBeNull();
    expect(within(screen.getByRole('region', { name: 'Recommended' })).getByRole('heading', { name: 'Start investing' })).toBeTruthy();
  });

  it('"Skip for now" keeps what was answered and goes straight back', async () => {
    const adapter = await bakedAdapter({ months: 3, answers: unknownDebt });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/placement?retake=1&return=/choose-loaf');
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect((await adapter.load()).profile?.cardDebt).toBeNull();
  });

  it('only returns to a path inside the app', async () => {
    const adapter = await bakedAdapter({ months: 3, answers: unknownDebt });
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter, '/placement?retake=1&return=//evil.example');
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
  });

  it('a student with a loaf cannot reopen placement without ?retake=1', async () => {
    const { pathname } = mount(await bakedAdapter(), '/placement');
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(pathname()).toBe('/');
  });
});

describe('risk quiz', () => {
  const pick = async (user: ReturnType<typeof userEvent.setup>, label: string, next: string) => {
    await user.click(await screen.findByRole('radio', { name: label }));
    await user.click(screen.getByRole('button', { name: next }));
  };

  /** Answers all four questions. */
  async function takeQuiz(user: ReturnType<typeof userEvent.setup>, answers: [string, string, string, string]) {
    await screen.findByText("Let's see what fits");
    await pick(user, answers[0], 'Next');
    await pick(user, answers[1], 'Next');
    await pick(user, answers[2], 'Next');
    await pick(user, answers[3], 'See what fits');
  }

  it('asks four questions, one per screen, with a progress bar and no right answers', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter({ months: 3 }), '/risk-quiz');
    await screen.findByText("Let's see what fits");
    expect(screen.getByText(/no right answers/)).toBeTruthy();
    const bar = screen.getByRole('progressbar', { name: 'Risk quiz progress' });
    expect(bar.getAttribute('aria-valuetext')).toBe('Question 1 of 4');
    expect(screen.getByText('When might you need this money?')).toBeTruthy();
    // Nothing is marked right or wrong, and the next button waits for a pick.
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'In 3 to 5 years' }));
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('If your investment dropped sharply in value in one month, what would you do?')).toBeTruthy();
    expect(bar.getAttribute('aria-valuetext')).toBe('Question 2 of 4');
    expect(document.querySelector('.choice--correct, .choice--incorrect')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect((await screen.findByRole('radio', { name: 'In 3 to 5 years' }) as HTMLInputElement).checked).toBe(true);
  });

  it('saves the answers and their result on the profile, then shows what fits', async () => {
    const adapter = await bakedAdapter({ months: 3 });
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter, '/risk-quiz');
    await takeQuiz(user, ['In more than 5 years', 'Wait it out', 'A balance of the two', 'A little']);
    await screen.findByRole('heading', { name: "Here's what fits" });
    expect(pathname()).toBe('/risk-result');
    const risk = (await adapter.load()).profile?.risk;
    expect(risk).toMatchObject({
      status: 'complete',
      answers: { horizon: 'over-five', drop: 'wait', priority: 'balance', experience: 'little' },
      result: { keepSavings: false, approach: 'growth', loaf: 'index-funds', where: 'roth-ira' },
    });
  });

  it('skipping asks first, keeps what was answered, and the rest take the cautious answer', async () => {
    const adapter = await bakedAdapter({ months: 3 });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/risk-quiz');
    await pick(user, 'In more than 5 years', 'Next');
    await user.click(await screen.findByRole('radio', { name: 'Add more' }));
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    expect(screen.getByRole('alertdialog').textContent).toContain('most cautious');
    await user.click(screen.getByRole('button', { name: 'Keep answering' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Skip for now' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { name: "Here's what fits" });
    expect(screen.getByText(/You skipped some questions/)).toBeTruthy();
    expect((await adapter.load()).profile?.risk).toMatchObject({ status: 'partial', answers: { horizon: 'over-five', drop: 'add-more' } });
  });

  it('skipping everything saves a skipped quiz with the steadier, cautious result', async () => {
    const adapter = await bakedAdapter({ months: 3 });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/risk-quiz');
    await user.click(await screen.findByRole('button', { name: 'Skip for now' }));
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    await screen.findByRole('heading', { name: 'A steadier approach' });
    expect((await adapter.load()).profile?.risk).toMatchObject({ status: 'skipped', answers: {}, result: { approach: 'steady', loaf: 'bonds' } });
  });

  it('fills in earlier answers when it is taken again', async () => {
    const adapter = await bakedAdapter({ months: 3 });
    await saveRisk(adapter, { horizon: 'three-to-five', drop: 'sell-some' });
    mount(adapter, '/risk-quiz');
    expect((await screen.findByRole('radio', { name: 'In 3 to 5 years' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('risk result', () => {
  const resultFor = async (answers: Parameters<typeof saveRisk>[1], fund: Fund = { months: 3 }) => {
    const adapter = await bakedAdapter(fund);
    await saveRisk(adapter, answers);
    return adapter;
  };

  it('under 3 years: suggests keeping it in savings and explains why, and offers Grow your cushion', async () => {
    const adapter = await resultFor({ horizon: 'within-year', drop: 'add-more', priority: 'growth', experience: 'yes' }, { months: 1 });
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/risk-result');
    await screen.findByRole('heading', { name: 'Keep this money in savings for now' });
    expect(screen.getByText(/shouldn't ride the ups and downs of the market/)).toBeTruthy();
    expect(screen.queryByText('A steadier approach')).toBeNull();
    expect(screen.queryByText('A growth-focused approach')).toBeNull();
    expect(screen.queryByText(/Where to hold it/)).toBeNull();
    expect(screen.getByRole('heading', { name: 'Grow your cushion to 3 months' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Grow my cushion' }));
    await screen.findByText(/^Whole fund/);
    expect((await adapter.load()).loaves[0]).toMatchObject({ targetCents: MONTH * 3, growFromCents: MONTH });
  });

  it('under 3 years with a fund of 3 months or more, offers growing to 6 months; at 6 months, nothing', async () => {
    mount(await resultFor({ horizon: 'one-to-three' }, { months: 3 }), '/risk-result');
    await screen.findByRole('heading', { name: 'Keep this money in savings for now' });
    expect(screen.getByRole('button', { name: 'Grow to 6 months' })).toBeTruthy();
    cleanup();
    mount(await resultFor({ horizon: 'one-to-three' }, { months: 6 }), '/risk-result');
    await screen.findByRole('heading', { name: 'Keep this money in savings for now' });
    expect(screen.queryByRole('button', { name: /Grow/ })).toBeNull();
  });

  it('a steadier approach: more bonds, the Bonds loaf (Coming soon), explained in plain language', async () => {
    mount(await resultFor({ horizon: 'over-five', drop: 'sell-some', priority: 'not-losing', experience: 'yes' }), '/risk-result');
    await screen.findByRole('heading', { name: 'A steadier approach' });
    expect(screen.getByText(/Here's what a steadier approach looks like and why/)).toBeTruthy();
    const bonds = getLoaf('bonds');
    expect(screen.getByText(`The loaf that fits: ${bonds.title} (${bonds.bread}).`)).toBeTruthy();
    expect(screen.getAllByText('Coming soon').length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: /Bonds|Index/ })).toBeNull();
  });

  it('a growth-focused approach: index funds', async () => {
    mount(await resultFor({ horizon: 'over-five', drop: 'add-more', priority: 'growth', experience: 'yes' }), '/risk-result');
    await screen.findByRole('heading', { name: 'A growth-focused approach' });
    expect(screen.getByText(`The loaf that fits: ${getLoaf('index-funds').title} (${getLoaf('index-funds').bread}).`)).toBeTruthy();
  });

  it('with earned income and more than 5 years: a Roth IRA, explained as an account that holds the investments', async () => {
    mount(await resultFor({ horizon: 'over-five', drop: 'wait', priority: 'balance' }), '/risk-result');
    await screen.findByRole('heading', { name: 'Where to hold it: a Roth IRA' });
    expect(screen.getByText(/It's an account that holds your investments/)).toBeTruthy();
  });

  it('for 3 to 5 years, even with earned income: a regular investment account', async () => {
    mount(await resultFor({ horizon: 'three-to-five', drop: 'add-more', priority: 'growth' }), '/risk-result');
    await screen.findByRole('heading', { name: 'Where to hold it: a regular investment account' });
    expect(screen.queryByText(/Roth IRA/)).toBeNull();
  });

  it('without earned income: a regular investment account', async () => {
    const answers = { ...baseAnswers, earnedIncome: false };
    mount(await resultFor({ horizon: 'over-five' }, { months: 3, answers }), '/risk-result');
    await screen.findByRole('heading', { name: 'Where to hold it: a regular investment account' });
  });

  it('with earned income unknown: never a Roth IRA, and says what it depends on', async () => {
    const answers: PlacementAnswers = { essentials: '250-499', accounts: ['checking'], cardDebt: 'no' };
    mount(await resultFor({ horizon: 'over-five' }, { months: 3, answers }), '/risk-result');
    await screen.findByRole('heading', { name: 'Where to hold it' });
    expect(screen.getByText(/depends on whether you earn income from a job/)).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Roth IRA/ })).toBeNull();
  });

  it('only the wording changes with investing experience: start small unless they have invested before', async () => {
    mount(await resultFor({ horizon: 'over-five', experience: 'none' }), '/risk-result');
    await screen.findByText(/start small while you learn/);
    cleanup();
    mount(await resultFor({ horizon: 'over-five', experience: 'yes' }), '/risk-result');
    await screen.findByRole('heading', { name: /Where to hold it/ });
    expect(screen.queryByText(/start small while you learn/)).toBeNull();
  });

  it('is educational: no percentages, allocations or instructions, and the knowledge check still applies', async () => {
    mount(await resultFor({ horizon: 'over-five', drop: 'wait', priority: 'balance', experience: 'little' }), '/risk-result');
    await screen.findByRole('heading', { name: "Here's what fits" });
    const text = document.body.textContent ?? '';
    expect(text).toContain('educational, not financial advice');
    expect(text).toContain('4 out of 5');
    expect(text).not.toMatch(/\d\s?%/);
    expect(text).not.toMatch(/\$\s?\d/);
    expect(text).not.toMatch(/\byou should (buy|sell|invest)\b/i);
  });

  it('goes back to the loaf or to the choices', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await resultFor({ horizon: 'over-five' });
    const { pathname } = mount(adapter, '/risk-result');
    await user.click(await screen.findByRole('button', { name: 'Back to my choices' }));
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(pathname()).toBe('/choose-loaf');
    cleanup();
    const second = mount(adapter, '/risk-result');
    await user.click(await screen.findByRole('button', { name: 'Back to my loaf' }));
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(second.pathname()).toBe('/');
  });

  it('is only shown after the quiz was taken or skipped', async () => {
    const { pathname } = mount(await bakedAdapter({ months: 3 }), '/risk-result');
    await screen.findByRole('heading', { name: 'Choose your next loaf' });
    expect(pathname()).toBe('/choose-loaf');
  });

  it('never changes loaves, balances or the shelf', async () => {
    const adapter = await resultFor({ horizon: 'over-five' });
    const before = await adapter.load();
    mount(adapter, '/risk-result');
    await screen.findByRole('heading', { name: "Here's what fits" });
    await waitFor(async () => expect((await adapter.load()).loaves).toEqual(before.loaves));
    expect((await adapter.load()).transactions).toEqual(before.transactions);
  });
});
