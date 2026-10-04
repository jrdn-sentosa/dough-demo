// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import { getLessons, getQuiz } from '../content/loader';
import { drawQuiz } from '../domain/drawQuiz';
import { shuffleQuiz } from '../domain/shuffle';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { AppData, QuizAttempt } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import type { PlacementAnswers } from '../domain/placement';
import { resetVideoProbe } from './videoAvailable';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetVideoProbe();
});

const loaf = { loafId: 'emergency-fund' as const, targetCents: 65_000, startedAt: '2026-01-01T00:00:00.000Z', bread: 'sandwich' as const, bakes: [], growFromCents: null };
const lessons = getLessons('emergency-fund');
const quiz = getQuiz('emergency-fund');

function dataFor(answers: PlacementAnswers = { accounts: ['checking'] }, attempts: QuizAttempt[] = []): AppData {
  return { ...emptyData(), user: { email: 'a@b.co' }, profile: profileFromAnswers(answers), loaves: [loaf], quizAttempts: attempts };
}

function attempt(mode: 'test-out' | 'lesson', score: number, missedLessons: string[] = []): QuizAttempt {
  return { id: 'quiz-1', loafId: 'emergency-fund', mode, score, total: 5, answers: {}, missedLessons, at: '2026-01-02T00:00:00.000Z' };
}

function mount(path: string, data: AppData): { adapter: DataAdapter; pathname: () => string; search: () => string } {
  const adapter = createMemoryAdapter(data);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { adapter, pathname: () => router.state.location.pathname, search: () => router.state.location.search };
}

const labelOf = (i: number, id: string) => quiz.questions[i].choices.find((c) => c.id === id)?.label ?? '';
const correct = (i: number) => labelOf(i, quiz.questions[i].answer);
const wrongId = (i: number) => quiz.questions[i].choices.find((c) => c.id !== quiz.questions[i].answer)?.id ?? '';
const wrong = (i: number) => labelOf(i, wrongId(i));

type User = ReturnType<typeof userEvent.setup>;

/** Matches a choice by its text. Choices can contain parentheses, so escape them. After a check the label also has hidden status text. */
const startsWith = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

/** The questions and choices are shuffled, so find which content question is on screen by its text. */
function shownIndex(): number {
  const text = document.querySelector('legend')?.textContent;
  const i = quiz.questions.findIndex((q) => q.question === text);
  if (i < 0) throw new Error(`no quiz question on screen: ${text}`);
  return i;
}

/**
 * Answers every question of one attempt, returning the bank indexes of the questions in the order they were shown.
 * An attempt asks `quiz.draw` of the bank's questions, so tests say which POSITIONS to get right (the first question
 * shown is position 0), and use the returned order to find out which questions those were.
 */
async function answerAll(user: User, rightAt: readonly number[], checkEach: boolean): Promise<number[]> {
  const order: number[] = [];
  for (let n = 0; n < quiz.draw; n++) {
    // `hidden: true` skips the accessibility-tree check, which is what makes role queries slow in jsdom.
    // Nothing on the quiz screen is hidden, so these still find the same elements.
    await screen.findByRole('button', { name: checkEach ? 'Check answer' : /^(Next question|See my score)$/, hidden: true });
    const i = shownIndex();
    order.push(i);
    await user.click(screen.getByRole('radio', { name: rightAt.includes(n) ? correct(i) : wrong(i), hidden: true }));
    if (checkEach) await user.click(screen.getByRole('button', { name: 'Check answer', hidden: true }));
    await user.click(
      screen.getByRole('button', { name: n === quiz.draw - 1 ? 'See my score' : 'Next question', hidden: true }),
    );
  }
  return order;
}

/** Normal mode: pick, Check answer, then Next question or See my score. `rightAt` are the positions answered correctly. */
const answerNormal = (user: User, rightAt: readonly number[]) => answerAll(user, rightAt, true);

/** Test-out mode: pick, then Next question or See my score. There is no Check step. */
const answerTestOut = (user: User, rightAt: readonly number[]) => answerAll(user, rightAt, false);

/** Every position of one attempt: answering all of them right. */
const all = Array.from({ length: quiz.draw }, (_, i) => i);

/** The bank indexes an attempt shows, in order, when `Math.random` always returns `value` (see `drawQuiz` and `shuffleQuiz`). */
const orderWhenRandomIs = (value: number, shuffled = true): number[] => {
  const drawn = drawQuiz(quiz.questions, quiz.draw, () => value);
  const asked = shuffled ? shuffleQuiz(drawn, () => value).map((s) => s.question) : drawn;
  return asked.map((q) => quiz.questions.indexOf(q));
};

describe('lessons list', () => {
  it('shows the three lessons in order with the test-out offer above and the quiz below', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname, search } = mount('/lessons', dataFor());
    await screen.findByRole('heading', { name: 'Your lessons' });
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(lessons.map((l) => expect.stringContaining(l.title)));

    const testOut = screen.getByRole('button', { name: 'Already know this? Take the quiz first' });
    const quizButton = screen.getByRole('button', { name: 'Take the quiz' });
    expect(testOut.compareDocumentPosition(links[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(links[2].compareDocumentPosition(quizButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await user.click(testOut);
    await waitFor(() => expect(pathname()).toBe('/quiz'));
    expect(search()).toBe('?mode=test-out');
  });

  it('collapses a lesson the student already knows from their accounts', async () => {
    mount('/lessons', dataFor({ accounts: ['checking', 'high-yield-savings'] }));
    await screen.findByRole('heading', { name: 'Your lessons' });
    const known = screen.getByText('You already know this').closest('details') as HTMLDetailsElement;
    expect(known).toBeTruthy();
    expect(known.open).toBe(false);
    expect(known.textContent).toContain(lessons[2].title);
    expect(within(known).getByRole('link', { name: 'Watch anyway' }).getAttribute('href')).toBe('/lessons/ef-where-to-keep');
    // The other two stay normal links.
    expect(screen.getAllByRole('link', { name: /Watch anyway/ })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Already know this? Take the quiz first' })).toBeTruthy();
  });

  it('after a failed test-out, recommends the missed lessons and collapses the rest', async () => {
    mount('/lessons', dataFor(undefined, [attempt('test-out', 2, ['ef-how-much'])]));
    await screen.findByRole('heading', { name: "Here's what to review" });
    expect(screen.getByRole('link', { name: new RegExp(lessons[1].title) }).textContent).toContain('Recommended');
    expect(screen.getAllByText('You got this one right')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Already know this? Take the quiz first' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Take the quiz' })).toBeTruthy();
  });

  it('when every lesson is optional, uses the doing-focused copy and leads with the way forward', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount('/lessons', dataFor(undefined, [attempt('test-out', 5)]));
    await screen.findByRole('heading', { name: "You know this. Let's make it happen." });
    expect(screen.queryByRole('button', { name: 'Already know this? Take the quiz first' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Take the quiz' })).toBeNull();
    const buttons = screen.getAllByRole('button').filter((b) => b.closest('details') === null);
    expect(buttons[0].textContent).toContain('Continue to saving setup');
    for (const d of document.querySelectorAll('details')) expect((d as HTMLDetailsElement).open).toBe(false);

    await user.click(buttons[0]);
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });
});

describe('lesson screen', () => {
  const first = lessons[0];

  it('plays video inline with captions, and the summary sits below it', async () => {
    mount(`/lessons/${first.id}`, dataFor());
    await screen.findByRole('heading', { name: first.title });
    const video = document.querySelector('video') as HTMLVideoElement;
    expect(video.hasAttribute('playsinline')).toBe(true);
    expect(video.getAttribute('src')).toBe(first.videoUrl);
    const track = video.querySelector('track') as HTMLTrackElement;
    expect(track.getAttribute('kind')).toBe('captions');
    expect(track.getAttribute('src')).toBe(first.captionsUrl);
    const summary = screen.getByText(/urgent costs you couldn't plan for/);
    expect(video.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows "Video coming soon" when the file is missing, and the summary and Mark as watched still work', async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter } = mount(`/lessons/${first.id}`, dataFor());
    await screen.findByRole('heading', { name: first.title });
    fireEvent.error(document.querySelector('video') as HTMLVideoElement);

    expect(await screen.findByText('Video coming soon')).toBeTruthy();
    expect(document.querySelector('video')).toBeNull();
    expect(screen.getByText(/urgent costs you couldn't plan for/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Mark as watched' }));
    expect(await screen.findByText(/Watched/)).toBeTruthy();
    expect((await adapter.load()).lessonProgress).toMatchObject([{ lessonId: first.id, how: 'manual' }]);
    expect(screen.queryByRole('button', { name: 'Mark as watched' })).toBeNull();
  });

  it('counts as watched at 90% of the video, and not before', async () => {
    const { adapter } = mount(`/lessons/${first.id}`, dataFor());
    await screen.findByRole('heading', { name: first.title });
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'duration', { value: 100, configurable: true });

    Object.defineProperty(video, 'currentTime', { value: 89, configurable: true });
    fireEvent.timeUpdate(video);
    expect((await adapter.load()).lessonProgress).toHaveLength(0);

    Object.defineProperty(video, 'currentTime', { value: 90, configurable: true });
    fireEvent.timeUpdate(video);
    await waitFor(async () => expect((await adapter.load()).lessonProgress).toMatchObject([{ lessonId: first.id, how: 'video' }]));
    fireEvent.timeUpdate(video);
    expect((await adapter.load()).lessonProgress).toHaveLength(1);
  });

  it('goes to the next lesson, and after the last one to the quiz', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(`/lessons/${first.id}`, dataFor());
    await user.click(await screen.findByRole('button', { name: 'Next lesson' }));
    await waitFor(() => expect(pathname()).toBe(`/lessons/${lessons[1].id}`));
    await user.click(await screen.findByRole('button', { name: 'Next lesson' }));
    await waitFor(() => expect(pathname()).toBe(`/lessons/${lessons[2].id}`));
    await user.click(await screen.findByRole('button', { name: 'Take the quiz' }));
    await waitFor(() => expect(pathname()).toBe('/quiz'));
  });

  it('skips a lesson collapsed as already known', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(`/lessons/${lessons[1].id}`, dataFor({ accounts: ['high-yield-savings'] }));
    await user.click(await screen.findByRole('button', { name: 'Take the quiz' }));
    await waitFor(() => expect(pathname()).toBe('/quiz'));
  });

  it('sends an unknown lesson back to the list', async () => {
    const { pathname } = mount('/lessons/nope', dataFor());
    await screen.findByRole('heading', { name: 'Your lessons' });
    expect(pathname()).toBe('/lessons');
  });
});

describe('loaf quiz (normal mode)', () => {
  it('shows one question per screen with a progress bar', async () => {
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('20');
    expect(screen.getByText('Question 1 of 5')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(quiz.questions[i].choices.length);
  });

  it('lets the student change their choice until they tap Check answer', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    const check = await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    expect((check as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    expect(screen.queryByRole('status')).toBeNull();
    await user.click(screen.getByRole('radio', { name: correct(i) }));
    expect((screen.getByRole('radio', { name: correct(i) }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: wrong(i) }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(quiz.questions[i].explain)).toBeNull();
  });

  it('a right answer shows sage feedback with the explanation, and locks the choices', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: correct(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    const feedback = screen.getByRole('status');
    expect(feedback.className).toContain('feedback--correct');
    expect(feedback.textContent).toContain('Correct');
    expect(feedback.textContent).toContain(quiz.questions[i].explain);
    expect(screen.queryByRole('link', { name: /Rewatch|Read the summary/ })).toBeNull();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => r.disabled)).toBe(true);
    expect(screen.getByRole('radio', { name: startsWith(correct(i)) }).closest('label')?.className).toContain('choice--correct');
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
  });

  it('a wrong answer shows crust (not red) feedback, the explanation, the answer, and a link to the summary when there is no video', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    const feedback = screen.getByRole('status');
    expect(feedback.className).toContain('feedback--wrong');
    expect(feedback.textContent).toContain('Not quite');
    expect(feedback.textContent).toContain(quiz.questions[i].explain);
    expect(feedback.textContent).toContain(`The answer: ${correct(i)}`);
    expect(screen.getByRole('radio', { name: startsWith(wrong(i)) }).closest('label')?.className).toContain('choice--incorrect');
    expect(screen.getByRole('radio', { name: startsWith(correct(i)) }).closest('label')?.className).toContain('choice--correct');

    const link = within(feedback).getByRole('link', { name: 'Read the summary' });
    expect(link.getAttribute('href')).toBe(`/lessons/${quiz.questions[i].lesson}?t=${quiz.questions[i].timestamp}`);
  });

  it('says "Rewatch this part" when the video file exists', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'video/mp4' } }));
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByRole('link', { name: 'Rewatch this part' })).toBeTruthy();
  });

  it('does not treat an index page answered for a missing video as a video', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'text/html; charset=utf-8' } }));
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByRole('link', { name: 'Read the summary' })).toBeTruthy();
  });

  // These three answer the whole quiz several times over, so they need more than the default 5s when the machine is busy.
  it('ends with the score, explains every missed question, saves the attempt, and allows a retry', { timeout: 15_000 }, async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter, pathname } = mount('/quiz', dataFor());
    const order = await answerNormal(user, [0, 2, 4]); // misses the questions shown second and fourth

    expect((await screen.findByRole('heading', { name: 'Your score' })).textContent).toBeTruthy();
    expect(screen.getByText('3 of 5 correct')).toBeTruthy();
    expect(screen.getByText(/You don't need a certain score to move on/)).toBeTruthy();
    for (const p of [1, 3]) expect(screen.getByText(quiz.questions[order[p]].explain)).toBeTruthy();
    expect(screen.queryByText(quiz.questions[order[0]].explain)).toBeNull();

    const saved = (await adapter.load()).quizAttempts;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ mode: 'lesson', score: 3, total: 5 });
    // The lessons to review come from the missed questions' own lesson links.
    expect([...saved[0].missedLessons].sort()).toEqual(
      [...new Set([order[1], order[3]].map((i) => quiz.questions[i].lesson))].sort(),
    );

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    await answerNormal(user, all);
    await screen.findByText('5 of 5 correct');
    expect((await adapter.load()).quizAttempts).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });

  it('has no pass gate: a score of zero still continues to saving setup', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount('/quiz', dataFor());
    await answerNormal(user, []);
    await screen.findByText('0 of 5 correct');
    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });

  it('has no cooldown: the student can retry right away, many times', { timeout: 15_000 }, async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter } = mount('/quiz', dataFor());
    for (let n = 1; n <= 3; n++) {
      await answerNormal(user, []);
      await screen.findByText('0 of 5 correct');
      expect((await adapter.load()).quizAttempts).toHaveLength(n);
      await user.click(screen.getByRole('button', { name: 'Try again' }));
    }
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
  });
});

describe('shuffling on the quiz screens', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the questions and choices in a different order on each attempt, and still grades by choice', { timeout: 15_000 }, async () => {
    const user = userEvent.setup({ delay: null });
    // 0.999 keeps the drawn questions in bank order and each list unrotated; 0 draws other questions and rotates the
    // lists, so the two attempts differ. `orderWhenRandomIs` works out what each should show from the same two functions.
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const { adapter } = mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const expected1 = orderWhenRandomIs(0.999);
    expect(shownIndex()).toBe(expected1[0]);
    const firstChoices = screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent);
    expect(firstChoices).toEqual(quiz.questions[expected1[0]].choices.map((c) => c.label));

    const order1 = await answerNormal(user, all);
    expect(order1).toEqual(expected1);
    await screen.findByText('5 of 5 correct');

    random.mockReturnValue(0);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('button', { name: 'Check answer' });
    const expected2 = orderWhenRandomIs(0);
    expect(shownIndex()).toBe(expected2[0]);
    const rotated = screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent);
    expect(rotated).not.toEqual(quiz.questions[shownIndex()].choices.map((c) => c.label));

    const order2 = await answerNormal(user, [0, 1, 2]);
    expect(order2).toEqual(expected2);
    expect(order2).not.toEqual(order1);
    await screen.findByText('3 of 5 correct');

    // Saved answers are the fixed choice ids from the content, whatever order they were shown in.
    const [first, second] = (await adapter.load()).quizAttempts;
    expect(first.answers).toEqual(Object.fromEntries(order1.map((i) => [quiz.questions[i].id, quiz.questions[i].answer])));
    expect(second.score).toBe(3);
    expect(Object.keys(second.answers).sort()).toEqual(order2.map((i) => quiz.questions[i].id).sort());
    for (const i of order2.slice(0, 3)) expect(second.answers[quiz.questions[i].id]).toBe(quiz.questions[i].answer);
    for (const i of order2.slice(3)) {
      const q = quiz.questions[i];
      expect(second.answers[q.id]).toBe(q.choices.find((c) => c.id !== q.answer)?.id);
    }
    expect([...second.missedLessons].sort()).toEqual([...new Set(order2.slice(3).map((i) => quiz.questions[i].lesson))].sort());
  });

  it('shuffles the test-out quiz too', async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mount('/quiz?mode=test-out', dataFor());
    await screen.findByRole('button', { name: 'Next question' });
    const expected = orderWhenRandomIs(0);
    expect(shownIndex()).toBe(expected[0]);
    const order = await answerTestOut(user, all);
    expect(order).toEqual(expected);
    expect(order).not.toEqual(orderWhenRandomIs(0, false)); // shuffled, not just drawn
    await screen.findByText('5 of 5 correct');
  });

  it.each([
    ['the quiz', '/quiz'],
    ['the test-out', '/quiz?mode=test-out'],
  ])('asks 5 of the 10 questions in %s, one or more from every lesson, and draws again on a retry', async (_name, path) => {
    const user = userEvent.setup({ delay: null });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const testOut = path.includes('test-out');
    mount(path, dataFor());
    await screen.findByRole('button', { name: testOut ? 'Next question' : 'Check answer' });
    const first = await (testOut ? answerTestOut : answerNormal)(user, all);
    await screen.findByText('5 of 5 correct');

    expect(first).toHaveLength(5);
    expect(new Set(first).size).toBe(5);
    expect(new Set(first.map((i) => quiz.questions[i].lesson))).toEqual(new Set(lessons.map((l) => l.id)));

    // Another attempt draws again: with a different "random" it asks a different set from the same bank.
    random.mockReturnValue(0);
    if (testOut) {
      cleanup();
      mount(path, dataFor());
      await screen.findByRole('button', { name: 'Next question' });
    } else {
      await user.click(screen.getByRole('button', { name: 'Try again' }));
      await screen.findByRole('button', { name: 'Check answer' });
    }
    const second = await (testOut ? answerTestOut : answerNormal)(user, all);
    expect(new Set(second).size).toBe(5);
    expect(new Set(second.map((i) => quiz.questions[i].lesson))).toEqual(new Set(lessons.map((l) => l.id)));
    expect([...second].sort()).not.toEqual([...first].sort());
  });

  it('links a missed question to the right lesson even when the choices were shuffled', async () => {
    const user = userEvent.setup({ delay: null });
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mount('/quiz', dataFor());
    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    const link = screen.getByRole('link', { name: 'Read the summary' });
    expect(link.getAttribute('href')).toBe(`/lessons/${quiz.questions[i].lesson}?t=${quiz.questions[i].timestamp}`);
    expect(screen.getByRole('status').textContent).toContain(`The answer: ${correct(i)}`);
  });
});

describe('test-out quiz', () => {
  it('gives no per-question feedback and has no Check answer step', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz?mode=test-out', dataFor());
    await screen.findByRole('button', { name: 'Next question' });
    const i = shownIndex();
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Next question' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(quiz.questions[i].explain)).toBeNull();
    expect(screen.queryByText('Not quite')).toBeNull();
    expect(screen.queryByText('Correct')).toBeNull();
    // Choices stay open, so the student can change their mind before moving on.
    await user.click(screen.getByRole('radio', { name: correct(i) }));
    expect((screen.getByRole('radio', { name: correct(i) }) as HTMLInputElement).disabled).toBe(false);
    expect(document.querySelector('.choice--correct, .choice--incorrect')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
  });

  it('4 of 5 makes the videos optional and moves on to saving setup', async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter, pathname } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, [0, 1, 2, 3]);

    expect((await screen.findByRole('heading', { name: "You know this. Let's make it happen." })).textContent).toBeTruthy();
    expect(screen.getByText('4 of 5 correct')).toBeTruthy();
    expect((await adapter.load()).quizAttempts).toMatchObject([{ mode: 'test-out', score: 4 }]);

    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });

  it('fewer than 4 shows the score and the lessons to review, and no answers or explanations', async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter } = mount('/quiz?mode=test-out', dataFor());
    // Get the questions shown first and last right; miss the three in between.
    const order = await answerTestOut(user, [0, 4]);

    await screen.findByText('2 of 5 correct');
    // Each missed question recommends the lesson its own link points to.
    const missedLessons = [...new Set([1, 2, 3].map((p) => quiz.questions[order[p]].lesson))];
    const review = screen.getByRole('region', { name: 'Lessons to review' });
    for (const id of missedLessons) expect(review.textContent).toContain(lessons.find((l) => l.id === id)?.title);

    const body = document.body.textContent ?? '';
    for (const q of quiz.questions) {
      expect(body).not.toContain(q.explain);
      expect(body).not.toContain(q.question);
      expect(body).not.toContain(q.choices.find((c) => c.id === q.answer)?.label);
    }
    expect(body).not.toContain('The answer:');
    expect(screen.queryByRole('link', { name: /Rewatch|Read the summary/ })).toBeNull();
    expect(screen.queryByText('Correct')).toBeNull();

    const saved = (await adapter.load()).quizAttempts;
    expect(saved).toMatchObject([{ mode: 'test-out', score: 2 }]);
    expect([...saved[0].missedLessons].sort()).toEqual([...missedLessons].sort());
  });

  it('after a failed test-out, the lessons come next and the retake uses normal mode with full feedback', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname, search } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, [0, 4]);
    await user.click(await screen.findByRole('button', { name: 'Go to my lessons' }));
    await waitFor(() => expect(pathname()).toBe('/lessons'));
    await screen.findByRole('heading', { name: "Here's what to review" });

    await user.click(screen.getByRole('button', { name: 'Take the quiz' }));
    await waitFor(() => expect(pathname()).toBe('/quiz'));
    expect(search()).toBe('');

    await screen.findByRole('button', { name: 'Check answer' });
    const i = shownIndex();
    await user.click(screen.getByRole('radio', { name: wrong(i) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    const feedback = screen.getByRole('status');
    expect(feedback.textContent).toContain('Not quite');
    expect(feedback.textContent).toContain(quiz.questions[i].explain);
  });

  it('a failed test-out does not open saving setup', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, [0, 4]);
    await screen.findByText('2 of 5 correct');
    expect(screen.queryByRole('button', { name: 'Continue to saving setup' })).toBeNull();
    expect(pathname()).toBe('/quiz');
  });
});

describe('mastery', () => {
  const tellsHowToMaster = 'Get 4 out of 5 to master these lessons. You can try again anytime.';

  it('3 out of 5 keeps the explanations and says how to master the lessons', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    const order = await answerNormal(user, [0, 1, 2]);
    await screen.findByText('3 of 5 correct');
    expect(screen.getByText(tellsHowToMaster)).toBeTruthy();
    expect(screen.queryByText("You mastered this loaf's lessons.")).toBeNull();
    for (const p of [3, 4]) expect(screen.getByText(quiz.questions[order[p]].explain)).toBeTruthy();
  });

  it.each([4, 5])('%i out of 5 says the lessons are mastered', async (score) => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await answerNormal(user, all.slice(0, score));
    await screen.findByText(`${score} of 5 correct`);
    expect(screen.getByText("You mastered this loaf's lessons.")).toBeTruthy();
    expect(screen.queryByText(tellsHowToMaster)).toBeNull();
  });

  it('offers Share only when this attempt mastered the lessons', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await answerNormal(user, all.slice(0, 4));
    await screen.findByText('4 of 5 correct');
    expect(screen.getByRole('button', { name: 'Share' })).toBeTruthy();
  });

  it('has no Share button below 4 out of 5, or at the end of the test-out', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor());
    await answerNormal(user, [0, 1, 2]);
    await screen.findByText('3 of 5 correct');
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
    cleanup();

    mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, all);
    await screen.findByRole('heading');
    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull();
  });

  it('a lower score after mastering says the best score still counts, and retries stay open', async () => {
    const user = userEvent.setup({ delay: null });
    mount('/quiz', dataFor(undefined, [attempt('lesson', 5)]));
    await answerNormal(user, [0]);
    await screen.findByText('1 of 5 correct');
    expect(screen.getByText("You've already mastered this loaf's lessons. Your best score still counts.")).toBeTruthy();
    expect(screen.queryByText(tellsHowToMaster)).toBeNull();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('shows a Mastered badge on the lessons list once any normal attempt reached 4 out of 5', async () => {
    mount('/lessons', dataFor(undefined, [attempt('lesson', 2), attempt('lesson', 4), attempt('lesson', 1)]));
    await screen.findByRole('heading', { name: 'Your lessons' });
    expect(screen.getByText('Mastered').className).toContain('badge');
  });

  it('shows no badge below 4 out of 5', async () => {
    mount('/lessons', dataFor(undefined, [attempt('lesson', 3)]));
    await screen.findByRole('heading', { name: 'Your lessons' });
    expect(screen.queryByText('Mastered')).toBeNull();
  });

  it('a perfect test-out does not master the lessons: no badge, and nothing about mastery on the end screen', async () => {
    const user = userEvent.setup({ delay: null });
    const { adapter } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, all);
    await screen.findByText('5 of 5 correct');
    expect(document.body.textContent).not.toContain('mastered');
    expect(document.body.textContent).not.toContain('Get 4 out of 5');
    expect((await adapter.load()).quizAttempts).toMatchObject([{ mode: 'test-out', score: 5 }]);

    cleanup();
    mount('/lessons', dataFor(undefined, [attempt('test-out', 5)]));
    await screen.findByRole('heading', { name: "You know this. Let's make it happen." });
    expect(screen.queryByText('Mastered')).toBeNull();
  });
});

describe('after the quiz', () => {
  it('opens saving setup once the quiz is done', async () => {
    mount('/saving-setup', dataFor(undefined, [attempt('lesson', 1, ['ef-how-much'])]));
    expect(await screen.findByRole('heading', { name: 'Open a high-yield savings account' })).toBeTruthy();
  });

  it('sends a student who has not taken the quiz back to the lessons', async () => {
    const { pathname } = mount('/saving-setup', dataFor());
    await screen.findByRole('heading', { name: 'Your lessons' });
    expect(pathname()).toBe('/lessons');
  });
});
