// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { guardRedirect } from '../app/guard';
import { routes } from '../app/router';
import { getQuiz } from '../content/loader';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { advance } from '../money/clock';
import { addStarting, startLoaf } from '../money/ledger';

afterEach(cleanup);

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;
const quiz = getQuiz(EF);

function attempt(score: number): QuizAttempt {
  return { id: 'quiz-1', loafId: EF, mode: 'lesson', score, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };
}

/** A returning student on Home with $240 saved, and the quiz done at `score` of 5. */
async function homeAdapter(score = 2): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user: { email: 'a@b.co' },
    profile: profileFromAnswers({ essentials: '250-499', accounts: ['checking', 'regular-savings'], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [attempt(score)],
  });
  await startLoaf(adapter, EF, dollars(400));
  await addStarting(adapter, EF, dollars(240));
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
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

/** Home loads, syncs points and picks the question before these show, which takes longer than 1s on a busy machine. */
const SLOW = { timeout: 5000 };

const pointsLink = (n: number | RegExp) =>
  screen.findByRole('link', { name: typeof n === 'number' ? new RegExp(`^${n} Dough points`) : n }, SLOW);

/** The daily quiz card, and the content question it is showing (the choices are shuffled, so find it by its text). */
async function dailyCard() {
  const card = await screen.findByRole('region', { name: 'Daily quiz' }, SLOW);
  const text = card.querySelector('legend')?.textContent;
  const question = quiz.questions.find((q) => q.question === text);
  if (!question) throw new Error(`no quiz question in the card: ${text}`);
  return { card, question };
}

const labelOf = (q: (typeof quiz.questions)[number], id: string) => q.choices.find((c) => c.id === id)?.label ?? '';
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

describe('Dough points on Home', () => {
  it('shows the total and links to the history', async () => {
    const adapter = await homeAdapter();
    const { pathname } = mount(adapter);
    const link = await pointsLink(0);
    expect(link.getAttribute('href')).toBe('/points');
    expect(link.textContent).toContain('Dough points');
    expect(pathname()).toBe('/');
  });

  it('back-fills a point for each finished day when the app is opened', async () => {
    const adapter = await homeAdapter();
    await advance(adapter, 3);
    mount(adapter);
    await pointsLink(3);
    expect((await adapter.load()).points.filter((p) => p.kind === 'fund-day')).toHaveLength(3);
  });

  it('adds the 5 mastery points once the quiz reached 4 of 5, and not before', async () => {
    mount(await homeAdapter(4));
    await pointsLink(5);
    cleanup();
    mount(await homeAdapter(3));
    await pointsLink(0);
  });
});

describe('the daily quiz card', () => {
  it('stays away until a module is mastered', async () => {
    mount(await homeAdapter(3));
    await pointsLink(0);
    expect(screen.queryByRole('region', { name: 'Daily quiz' })).toBeNull();
  });

  it('asks one question, and a right answer earns a point and shows the explanation', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter);
    const { card, question } = await dailyCard();

    expect(within(card).getByRole('button', { name: 'Check answer' }).hasAttribute('disabled')).toBe(true);
    await user.click(within(card).getByRole('radio', { name: startsWith(labelOf(question, question.answer)) }));
    await user.click(within(card).getByRole('button', { name: 'Check answer' }));

    expect(await within(card).findByText("That's right. +1 point.", {}, SLOW)).toBeTruthy();
    expect(within(card).getByText(question.explain)).toBeTruthy();
    expect(within(card).getByText(/A new one is waiting tomorrow/)).toBeTruthy();
    expect(within(card).queryByRole('button', { name: 'Check answer' })).toBeNull();
    // Mastery 5 + the quiz point 1.
    await pointsLink(6);
    expect((await adapter.load()).points.map((p) => p.kind)).toContain('quiz');
  });

  it('shows the explanation for a wrong answer too, with no point', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter);
    const { card, question } = await dailyCard();

    const wrongId = question.choices.find((c) => c.id !== question.answer)!.id;
    await user.click(within(card).getByRole('radio', { name: startsWith(labelOf(question, wrongId)) }));
    await user.click(within(card).getByRole('button', { name: 'Check answer' }));

    expect(await within(card).findByText("Not quite. Here's the idea:", {}, SLOW)).toBeTruthy();
    expect(within(card).getByText(question.explain)).toBeTruthy();
    expect(within(card).getByText(`The answer: ${labelOf(question, question.answer)}`)).toBeTruthy();
    await pointsLink(5);
    expect((await adapter.load()).points.map((p) => p.kind)).not.toContain('quiz');
  });

  it('keeps the same question on a reload, and the answered state', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter);
    const first = await dailyCard();
    await user.click(within(first.card).getAllByRole('radio')[0]);
    await user.click(within(first.card).getByRole('button', { name: 'Check answer' }));
    await within(first.card).findByText(/A new one is waiting tomorrow/, {}, SLOW);
    cleanup();

    mount(adapter);
    const again = await dailyCard();
    expect(again.question.id).toBe(first.question.id);
    expect(within(again.card).getByText(/A new one is waiting tomorrow/)).toBeTruthy();
  });

  it('asks a new question the next day, not one of the last three', async () => {
    const adapter = await homeAdapter(4);
    const seen: string[] = [];
    for (let day = 0; day < 4; day++) {
      mount(adapter);
      seen.push((await dailyCard()).question.id);
      cleanup();
      await advance(adapter, 1);
    }
    expect(new Set(seen).size).toBe(4);
  });
});

describe('the points history', () => {
  async function withPoints(): Promise<DataAdapter> {
    const adapter = await homeAdapter();
    const data = await adapter.load();
    data.points = [
      { key: 'video:ef-what-its-for', kind: 'video', points: 1, at: new Date(2026, 9, 3, 10).toISOString(), ref: 'ef-what-its-for' },
      { key: 'mastery:emergency-fund', kind: 'mastery', points: 5, at: new Date(2026, 9, 4, 10).toISOString(), ref: EF },
      { key: 'fund-day:2026-10-05', kind: 'fund-day', points: 1, at: new Date(2026, 9, 5, 23, 59).toISOString(), ref: '2026-10-05' },
    ];
    await adapter.save(data);
    return adapter;
  }

  it('lists what earned each point and when, newest first, with the total', async () => {
    mount(await withPoints(), '/points');
    expect(await screen.findByRole('heading', { name: 'Your Dough points' }, SLOW)).toBeTruthy();
    expect(screen.getByText('7 points in all')).toBeTruthy();
    const rows = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('Your fund held steady on Oct 5');
    expect(rows[0]).toContain('+1');
    expect(rows[1]).toContain('Mastered the Emergency fund lessons');
    expect(rows[1]).toContain('+5');
    expect(rows[1]).toContain('Oct 4');
    expect(rows[2]).toMatch(/Watched ".+"/);
    expect(screen.getByText(/aren't money/)).toBeTruthy();
  });

  it('is calm when there are no points yet', async () => {
    mount(await homeAdapter(), '/points');
    expect(await screen.findByText('Your points will show up here as you go.', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('0 points in all')).toBeTruthy();
  });

  it('goes back to Home', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await homeAdapter(), '/points');
    await user.click(await screen.findByRole('button', { name: 'Back to Home' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/'));
  });

  it('needs a signed-in student with a loaf', () => {
    expect(guardRedirect('/points', emptyData())).toBe('/login');
    expect(guardRedirect('/points', { ...emptyData(), user: { email: 'a@b.co' } })).toBe('/placement');
  });
});
