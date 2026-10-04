// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import { getLessons, getQuiz } from '../content/loader';
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

const loaf = { loafId: 'emergency-fund' as const, targetCents: 65_000, startedAt: '2026-01-01T00:00:00.000Z', bakes: [], growFromCents: null };
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

const correct = (i: number) => quiz.questions[i].choices[quiz.questions[i].answer];
const wrong = (i: number) => quiz.questions[i].choices[(quiz.questions[i].answer + 1) % quiz.questions[i].choices.length];

/** Normal mode: pick, Check answer, then Next question or See my score. */
async function answerNormal(user: ReturnType<typeof userEvent.setup>, picks: string[]) {
  for (let i = 0; i < picks.length; i++) {
    await user.click(await screen.findByRole('radio', { name: picks[i] }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    await user.click(screen.getByRole('button', { name: i === picks.length - 1 ? 'See my score' : 'Next question' }));
  }
}

/** Test-out mode: pick, then Next question or See my score. There is no Check step. */
async function answerTestOut(user: ReturnType<typeof userEvent.setup>, picks: string[]) {
  for (let i = 0; i < picks.length; i++) {
    await user.click(await screen.findByRole('radio', { name: picks[i] }));
    await user.click(screen.getByRole('button', { name: i === picks.length - 1 ? 'See my score' : 'Next question' }));
  }
}

describe('lessons list', () => {
  it('shows the three lessons in order with the test-out offer above and the quiz below', async () => {
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
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
    const user = userEvent.setup();
    const { pathname } = mount(`/lessons/${first.id}`, dataFor());
    await user.click(await screen.findByRole('button', { name: 'Next lesson' }));
    await waitFor(() => expect(pathname()).toBe(`/lessons/${lessons[1].id}`));
    await user.click(await screen.findByRole('button', { name: 'Next lesson' }));
    await waitFor(() => expect(pathname()).toBe(`/lessons/${lessons[2].id}`));
    await user.click(await screen.findByRole('button', { name: 'Take the quiz' }));
    await waitFor(() => expect(pathname()).toBe('/quiz'));
  });

  it('skips a lesson collapsed as already known', async () => {
    const user = userEvent.setup();
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
    await screen.findByRole('radio', { name: quiz.questions[0].choices[0] });
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('20');
    expect(screen.getByText('Question 1 of 5')).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(quiz.questions[0].choices.length);
  });

  it('lets the student change their choice until they tap Check answer', async () => {
    const user = userEvent.setup();
    mount('/quiz', dataFor());
    const check = await screen.findByRole('button', { name: 'Check answer' });
    expect((check as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: wrong(0) }));
    expect(screen.queryByRole('status')).toBeNull();
    await user.click(screen.getByRole('radio', { name: correct(0) }));
    expect((screen.getByRole('radio', { name: correct(0) }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole('radio', { name: wrong(0) }) as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(quiz.questions[0].explain)).toBeNull();
  });

  it('a right answer shows sage feedback with the explanation, and locks the choices', async () => {
    const user = userEvent.setup();
    mount('/quiz', dataFor());
    await user.click(await screen.findByRole('radio', { name: correct(0) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    const feedback = screen.getByRole('status');
    expect(feedback.className).toContain('feedback--correct');
    expect(feedback.textContent).toContain('Correct');
    expect(feedback.textContent).toContain(quiz.questions[0].explain);
    expect(screen.queryByRole('link', { name: /Rewatch|Read the summary/ })).toBeNull();
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios.every((r) => r.disabled)).toBe(true);
    expect(screen.getByRole('radio', { name: new RegExp(correct(0)) }).closest('label')?.className).toContain('choice--correct');
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
  });

  it('a wrong answer shows crust (not red) feedback, the explanation, the answer, and a link to the summary when there is no video', async () => {
    const user = userEvent.setup();
    mount('/quiz', dataFor());
    await user.click(await screen.findByRole('radio', { name: wrong(0) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));

    const feedback = screen.getByRole('status');
    expect(feedback.className).toContain('feedback--wrong');
    expect(feedback.textContent).toContain('Not quite');
    expect(feedback.textContent).toContain(quiz.questions[0].explain);
    expect(feedback.textContent).toContain(`The answer: ${correct(0)}`);
    const picked = screen.getByRole('radio', { name: new RegExp(wrong(0)) }).closest('label');
    expect(picked?.className).toContain('choice--incorrect');
    expect(screen.getByRole('radio', { name: new RegExp(correct(0)) }).closest('label')?.className).toContain('choice--correct');

    const link = within(feedback).getByRole('link', { name: 'Read the summary' });
    expect(link.getAttribute('href')).toBe(`/lessons/${quiz.questions[0].lesson}?t=${quiz.questions[0].timestamp}`);
  });

  it('says "Rewatch this part" when the video file exists', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'video/mp4' } }));
    const user = userEvent.setup();
    mount('/quiz', dataFor());
    await user.click(await screen.findByRole('radio', { name: wrong(0) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByRole('link', { name: 'Rewatch this part' })).toBeTruthy();
  });

  it('does not treat an index page answered for a missing video as a video', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'text/html; charset=utf-8' } }));
    const user = userEvent.setup();
    mount('/quiz', dataFor());
    await user.click(await screen.findByRole('radio', { name: wrong(0) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    expect(await screen.findByRole('link', { name: 'Read the summary' })).toBeTruthy();
  });

  it('ends with the score, explains every missed question, saves the attempt, and allows a retry', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/quiz', dataFor());
    await answerNormal(user, [correct(0), wrong(1), correct(2), wrong(3), correct(4)]);

    expect((await screen.findByRole('heading', { name: 'Your score' })).textContent).toBeTruthy();
    expect(screen.getByText('3 of 5 correct')).toBeTruthy();
    expect(screen.getByText(/There's no passing score here/)).toBeTruthy();
    for (const i of [1, 3]) expect(screen.getByText(quiz.questions[i].explain)).toBeTruthy();
    expect(screen.queryByText(quiz.questions[0].explain)).toBeNull();

    const saved = (await adapter.load()).quizAttempts;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ mode: 'lesson', score: 3, total: 5 });
    expect(saved[0].missedLessons).toEqual([...new Set([quiz.questions[1].lesson, quiz.questions[3].lesson])]);

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Question 1 of 5')).toBeTruthy();
    await answerNormal(user, quiz.questions.map((_, i) => correct(i)));
    await screen.findByText('5 of 5 correct');
    expect((await adapter.load()).quizAttempts).toHaveLength(2);

    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });

  it('has no pass gate: a score of zero still continues to saving setup', async () => {
    const user = userEvent.setup();
    const { pathname } = mount('/quiz', dataFor());
    await answerNormal(user, quiz.questions.map((_, i) => wrong(i)));
    await screen.findByText('0 of 5 correct');
    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });
});

describe('test-out quiz', () => {
  const picksFor = (rightOnes: number[]) => quiz.questions.map((_, i) => (rightOnes.includes(i) ? correct(i) : wrong(i)));

  it('gives no per-question feedback and has no Check answer step', async () => {
    const user = userEvent.setup();
    mount('/quiz?mode=test-out', dataFor());
    await screen.findByRole('radio', { name: correct(0) });
    expect(screen.queryByRole('button', { name: 'Check answer' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Next question' }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole('radio', { name: wrong(0) }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(quiz.questions[0].explain)).toBeNull();
    expect(screen.queryByText('Not quite')).toBeNull();
    expect(screen.queryByText('Correct')).toBeNull();
    // Choices stay open, so the student can change their mind before moving on.
    await user.click(screen.getByRole('radio', { name: correct(0) }));
    expect((screen.getByRole('radio', { name: correct(0) }) as HTMLInputElement).disabled).toBe(false);
    expect(document.querySelector('.choice--correct, .choice--incorrect')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Next question' }));
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('40');
  });

  it('4 of 5 makes the videos optional and moves on to saving setup', async () => {
    const user = userEvent.setup();
    const { adapter, pathname } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, picksFor([0, 1, 2, 3]));

    expect((await screen.findByRole('heading', { name: "You know this. Let's make it happen." })).textContent).toBeTruthy();
    expect(screen.getByText('4 of 5 correct')).toBeTruthy();
    expect((await adapter.load()).quizAttempts).toMatchObject([{ mode: 'test-out', score: 4 }]);

    await user.click(screen.getByRole('button', { name: 'Continue to saving setup' }));
    await waitFor(() => expect(pathname()).toBe('/saving-setup'));
  });

  it('fewer than 4 shows the score and the lessons to review, and no answers or explanations', async () => {
    const user = userEvent.setup();
    const { adapter } = mount('/quiz?mode=test-out', dataFor());
    // Miss questions 1 and 2 (the lessons they cover), get the rest right.
    const missed = [1, 2, 3];
    await answerTestOut(user, picksFor([0, 4]));

    await screen.findByText('2 of 5 correct');
    const missedLessons = [...new Set(missed.map((i) => quiz.questions[i].lesson))];
    const review = screen.getByRole('region', { name: 'Lessons to review' });
    for (const id of missedLessons) expect(review.textContent).toContain(lessons.find((l) => l.id === id)?.title);

    const body = document.body.textContent ?? '';
    for (const q of quiz.questions) {
      expect(body).not.toContain(q.explain);
      expect(body).not.toContain(q.question);
      expect(body).not.toContain(q.choices[q.answer]);
    }
    expect(body).not.toContain('The answer:');
    expect(screen.queryByRole('link', { name: /Rewatch|Read the summary/ })).toBeNull();
    expect(screen.queryByText('Correct')).toBeNull();

    const saved = (await adapter.load()).quizAttempts;
    expect(saved).toMatchObject([{ mode: 'test-out', score: 2 }]);
    expect(saved[0].missedLessons).toEqual(missedLessons);
  });

  it('after a failed test-out, the lessons come next and the retake uses normal mode with full feedback', async () => {
    const user = userEvent.setup();
    const { pathname, search } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, picksFor([0, 4]));
    await user.click(await screen.findByRole('button', { name: 'Go to my lessons' }));
    await waitFor(() => expect(pathname()).toBe('/lessons'));
    await screen.findByRole('heading', { name: "Here's what to review" });

    await user.click(screen.getByRole('button', { name: 'Take the quiz' }));
    await waitFor(() => expect(pathname()).toBe('/quiz'));
    expect(search()).toBe('');

    await user.click(await screen.findByRole('radio', { name: wrong(0) }));
    await user.click(screen.getByRole('button', { name: 'Check answer' }));
    const feedback = screen.getByRole('status');
    expect(feedback.textContent).toContain('Not quite');
    expect(feedback.textContent).toContain(quiz.questions[0].explain);
  });

  it('a failed test-out does not open saving setup', async () => {
    const user = userEvent.setup();
    const { pathname } = mount('/quiz?mode=test-out', dataFor());
    await answerTestOut(user, picksFor([0, 4]));
    await screen.findByText('2 of 5 correct');
    expect(screen.queryByRole('button', { name: 'Continue to saving setup' })).toBeNull();
    expect(pathname()).toBe('/quiz');
  });
});

describe('after the quiz', () => {
  it('shows the saving setup placeholder once the quiz is done', async () => {
    mount('/saving-setup', dataFor(undefined, [attempt('lesson', 1, ['ef-how-much'])]));
    expect(await screen.findByRole('heading', { name: 'Saving setup' })).toBeTruthy();
  });

  it('sends a student who has not taken the quiz back to the lessons', async () => {
    const { pathname } = mount('/saving-setup', dataFor());
    await screen.findByRole('heading', { name: 'Your lessons' });
    expect(pathname()).toBe('/lessons');
  });
});
