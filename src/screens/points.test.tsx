// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

/**
 * The question on screen and the content question it is (the choices are shuffled, so find it by its text).
 * `scope` is the whole screen: the quiz is one question per screen, with no region around it.
 */
async function shownQuestion() {
  const legend = await screen.findByText((_, el) => el?.tagName === 'LEGEND', {}, SLOW);
  const question = quiz.questions.find((q) => q.question === legend.textContent);
  if (!question) throw new Error(`no quiz question on screen: ${legend.textContent}`);
  return question;
}

const labelOf = (q: (typeof quiz.questions)[number], id: string) => q.choices.find((c) => c.id === id)?.label ?? '';
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

/** Answers the question on screen with its right answer (or a wrong one) and checks it. */
async function answerShown(user: ReturnType<typeof userEvent.setup>, right: boolean) {
  const question = await shownQuestion();
  const id = right ? question.answer : question.choices.find((c) => c.id !== question.answer)!.id;
  await user.click(screen.getByRole('radio', { name: startsWith(labelOf(question, id)) }));
  await user.click(screen.getByRole('button', { name: 'Check answer' }));
  return question;
}

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

describe('the daily quiz waiting dot on Home', () => {
  it('stays away until a module is mastered', async () => {
    mount(await homeAdapter(3));
    const link = await pointsLink(0);
    expect(link.getAttribute('aria-label')).not.toMatch(/daily quiz/i);
    expect(link.querySelector('.home__points-dot')).toBeNull();
  });

  it("shows on the points total while today's quiz is waiting, with a label that isn't just a colour", async () => {
    mount(await homeAdapter(4));
    const link = await pointsLink(/Daily quiz/i);
    expect(link.getAttribute('aria-label')).toMatch(/Today's daily quiz is waiting/);
    expect(link.querySelector('.home__points-dot')).not.toBeNull();
  });

  it('goes away once today\'s quiz is finished, and comes back the next day', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');
    for (let i = 0; i < 3; i++) {
      await answerShown(user, true);
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    cleanup();
    mount(adapter);
    const link = await pointsLink(/Dough points/);
    expect(link.getAttribute('aria-label')).not.toMatch(/daily quiz/i);
    expect(link.querySelector('.home__points-dot')).toBeNull();
    cleanup();
    await advance(adapter, 1);
    mount(adapter);
    expect((await pointsLink(/Dough points/)).querySelector('.home__points-dot')).not.toBeNull();
  });
});

describe('the Points screen button', () => {
  it("has a \"Take today's quiz\" button at the top while the quiz is waiting", async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await homeAdapter(4), '/points');
    const button = await screen.findByRole('button', { name: "Take today's quiz" }, SLOW);
    // It comes before the title's text and the history.
    const heading = screen.getByRole('heading', { name: 'Your Dough points' });
    expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(button.compareDocumentPosition(screen.getByText(/in all/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(button);
    await waitFor(() => expect(pathname()).toBe('/daily-quiz'));
  });

  it('is not there before a module is mastered', async () => {
    mount(await homeAdapter(3), '/points');
    await screen.findByRole('heading', { name: 'Your Dough points' }, SLOW);
    expect(screen.queryByRole('button', { name: "Take today's quiz" })).toBeNull();
  });

  it('is not there once today\'s quiz is finished', async () => {
    const adapter = await homeAdapter(4);
    const user = userEvent.setup({ delay: null });
    mount(adapter, '/daily-quiz');
    for (let i = 0; i < 3; i++) {
      await answerShown(user, false);
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    cleanup();
    mount(adapter, '/points');
    await screen.findByRole('heading', { name: 'Your Dough points' }, SLOW);
    expect(screen.queryByRole('button', { name: "Take today's quiz" })).toBeNull();
  });
});

describe('the daily quiz screen', () => {
  it('needs a signed-in student with a loaf', () => {
    expect(guardRedirect('/daily-quiz', emptyData())).toBe('/login');
    expect(guardRedirect('/daily-quiz', { ...emptyData(), user: { email: 'a@b.co' } })).toBe('/placement');
  });

  it('says it opens once a module is mastered, when none is', async () => {
    mount(await homeAdapter(3), '/daily-quiz');
    expect(await screen.findByText(/opens once you've mastered/, {}, SLOW)).toBeTruthy();
  });

  it('asks 3 questions one at a time, with the explanation after each answer', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');

    const seen = new Set<string>();
    for (let i = 0; i < 3; i++) {
      expect(await screen.findByText(`Question ${i + 1} of 3`, { selector: 'p' }, SLOW)).toBeTruthy();
      expect(screen.getByRole('progressbar')).toBeTruthy();
      const checkButton = screen.getByRole('button', { name: 'Check answer' });
      expect(checkButton.hasAttribute('disabled')).toBe(true);
      const question = await answerShown(user, i !== 1);
      seen.add(question.id);
      expect(await screen.findByText(question.explain, {}, SLOW)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
      await user.click(screen.getByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }));
    }
    expect(seen.size).toBe(3);
    expect(await screen.findByText('You got 2 of 3 right.', {}, SLOW)).toBeTruthy();
  });

  it('shows "That\'s right." for a right answer and the answer for a wrong one', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter(4), '/daily-quiz');
    const question = await answerShown(user, false);
    expect(await screen.findByText("Not quite. Here's the idea:", {}, SLOW)).toBeTruthy();
    expect(screen.getByText(`The answer: ${labelOf(question, question.answer)}`)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Next question' }));
    await answerShown(user, true);
    expect(await screen.findByText("That's right.", {}, SLOW)).toBeTruthy();
  });

  it('gives 1 point for finishing, and 1 more for all 3 right', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');
    for (let i = 0; i < 3; i++) {
      await answerShown(user, true);
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    expect(await screen.findByText('You got 3 of 3 right.', {}, SLOW)).toBeTruthy();
    expect(screen.getByText('+1 point for finishing.')).toBeTruthy();
    expect(screen.getByText('+1 extra point for getting every question right.')).toBeTruthy();
    const kinds = (await adapter.load()).points.map((p) => p.kind);
    expect(kinds).toContain('quiz');
    expect(kinds).toContain('quiz-bonus');
  });

  it('gives only the finishing point with a wrong answer, and says nothing guilty', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');
    for (let i = 0; i < 3; i++) {
      await answerShown(user, i !== 0);
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    expect(await screen.findByText('+1 point for finishing.', {}, SLOW)).toBeTruthy();
    expect(screen.queryByText(/extra point/)).toBeNull();
    expect((await adapter.load()).points.map((p) => p.kind)).not.toContain('quiz-bonus');
  });

  it('keeps the same questions on a reload, and picks up at the first one not answered', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');
    const firstQuestion = await answerShown(user, true);
    await screen.findByRole('button', { name: 'Next question' }, SLOW);
    const asked = (await adapter.load()).dailyQuizzes[0].questions.map((q) => q.questionId);
    cleanup();

    mount(adapter, '/daily-quiz');
    expect(await screen.findByText('Question 2 of 3', { selector: 'p' }, SLOW)).toBeTruthy();
    expect((await shownQuestion()).id).toBe(asked[1]);
    expect(asked[0]).toBe(firstQuestion.id);
    expect((await adapter.load()).dailyQuizzes[0].questions.map((q) => q.questionId)).toEqual(asked);
  });

  it("is a calm 'already done' page after today's quiz, and never asks again", async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = await homeAdapter(4);
    mount(adapter, '/daily-quiz');
    for (let i = 0; i < 3; i++) {
      await answerShown(user, true);
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    cleanup();
    mount(adapter, '/daily-quiz');
    expect(await screen.findByText(/You've finished today's quiz/, {}, SLOW)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
    expect((await adapter.load()).points.filter((p) => p.kind === 'quiz' || p.kind === 'quiz-bonus')).toHaveLength(2);
  });

  it('asks new questions the next day, not the ones from the previous 2 days', async () => {
    const adapter = await homeAdapter(4);
    const days: string[][] = [];
    for (let day = 0; day < 3; day++) {
      mount(adapter, '/daily-quiz');
      await screen.findByText('Question 1 of 3', { selector: 'p' }, SLOW);
      cleanup();
      const entries = (await adapter.load()).dailyQuizzes;
      days.push(entries[entries.length - 1].questions.map((q) => q.questionId));
      await advance(adapter, 1);
    }
    expect(new Set(days.flat()).size).toBe(9);
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
