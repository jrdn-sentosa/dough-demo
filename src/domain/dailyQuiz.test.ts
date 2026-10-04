import { describe, expect, it } from 'vitest';
import {
  DAILY_QUESTIONS,
  isFinished,
  isPerfect,
  pickDailyQuestions,
  popupDue,
  quizWaiting,
  type DailyQuestionEntry,
  type DailyQuizEntry,
  type PoolQuestion,
  type PopupInputs,
} from './dailyQuiz';

const pool = (n: number): PoolQuestion[] =>
  Array.from({ length: n }, (_, i) => ({ loafId: 'emergency-fund', id: `q${i + 1}` }));

const q = (id: string, choiceId: string | null = null, correct: boolean | null = null): DailyQuestionEntry => ({
  loafId: 'emergency-fund',
  questionId: id,
  choiceId,
  correct,
});

const shown = (day: string, ...ids: string[]): DailyQuizEntry => ({ day, questions: ids.map((id) => q(id)) });

/** A "random" that always picks the first option, so the order of the pool decides. */
const first = () => 0;
const ids = (picked: PoolQuestion[]) => picked.map((p) => p.id);

describe('pickDailyQuestions', () => {
  it('asks 3 different questions', () => {
    expect(DAILY_QUESTIONS).toBe(3);
    const picked = pickDailyQuestions(pool(10), [], first);
    expect(picked).toHaveLength(3);
    expect(new Set(ids(picked)).size).toBe(3);
  });

  it('is empty for an empty pool (nothing mastered yet)', () => {
    expect(pickDailyQuestions([], [], first)).toEqual([]);
  });

  it('avoids the questions shown on the previous 2 days', () => {
    const entries = [shown('2026-10-02', 'q1', 'q2', 'q3'), shown('2026-10-03', 'q4', 'q5', 'q6')];
    for (const r of [0, 0.5, 0.99]) {
      expect(ids(pickDailyQuestions(pool(10), entries, () => r)).sort()).toEqual(
        expect.not.arrayContaining(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']),
      );
    }
  });

  it('only looks back 2 days: a question from 3 days ago is allowed again', () => {
    const entries = [shown('2026-10-01', 'q1', 'q2', 'q3'), shown('2026-10-02', 'q4', 'q5', 'q6'), shown('2026-10-03', 'q7', 'q8', 'q9')];
    // Only 10-02 and 10-03 count, so q1 to q3 (shown on 10-01) are free again, along with q10.
    for (const r of [0, 0.5, 0.99]) {
      const picked = ids(pickDailyQuestions(pool(10), entries, () => r));
      expect(picked).toHaveLength(3);
      expect(picked.every((id) => ['q1', 'q2', 'q3', 'q10'].includes(id))).toBe(true);
    }
  });

  it('brings back the older day first, then the newest, when the pool is too small', () => {
    const entries = [shown('2026-10-02', 'q1', 'q2', 'q3'), shown('2026-10-03', 'q4', 'q5', 'q6')];
    // 7 questions: q7 is fresh, so 2 more come from the older day (q1 to q3) before anything from yesterday.
    const picked = ids(pickDailyQuestions(pool(7), entries, first));
    expect(picked[0]).toBe('q7');
    expect(picked.slice(1).every((id) => ['q1', 'q2', 'q3'].includes(id))).toBe(true);
    // 6 questions, all shown recently: still 3, and the older day's questions are the ones that return.
    expect(ids(pickDailyQuestions(pool(6), entries, first)).sort()).toEqual(['q1', 'q2', 'q3']);
  });

  it('asks everything there is when the pool has fewer than 3', () => {
    expect(ids(pickDailyQuestions(pool(2), [shown('2026-10-03', 'q1')], first)).sort()).toEqual(['q1', 'q2']);
    expect(ids(pickDailyQuestions(pool(1), [shown('2026-10-03', 'q1')], first))).toEqual(['q1']);
  });

  it('counts the last 2 days the quiz ran, in any order of the list', () => {
    const entries = [shown('2026-10-03', 'q4', 'q5', 'q6'), shown('2026-10-01', 'q1', 'q2', 'q3'), shown('2026-10-02', 'q7', 'q8', 'q9')];
    // The last 2 are 10-02 and 10-03; 10-01's questions are free.
    const picked = ids(pickDailyQuestions(pool(10), entries, first));
    expect(picked.every((id) => ['q1', 'q2', 'q3', 'q10'].includes(id))).toBe(true);
  });

  it('works with a day saved when the quiz asked a single question', () => {
    expect(ids(pickDailyQuestions(pool(4), [shown('2026-10-03', 'q1')], first)).sort()).toEqual(['q2', 'q3', 'q4']);
  });

  it('keeps questions from different loaves apart', () => {
    const mixed: PoolQuestion[] = [
      { loafId: 'emergency-fund', id: 'q1' },
      { loafId: 'index-funds', id: 'q1' },
    ];
    expect(pickDailyQuestions(mixed, [shown('2026-10-03', 'q1')], first, 1)[0].loafId).toBe('index-funds');
  });
});

describe('finishing and the perfect bonus', () => {
  it('is finished only when every question has an answer', () => {
    expect(isFinished(null)).toBe(false);
    expect(isFinished({ day: 'd', questions: [q('a', 'x', true), q('b')] })).toBe(false);
    expect(isFinished({ day: 'd', questions: [q('a', 'x', true), q('b', 'y', false)] })).toBe(true);
  });

  it('is perfect only for a full quiz with every answer right', () => {
    const right = (n: number) => ({ day: 'd', questions: Array.from({ length: n }, (_, i) => q(`q${i}`, 'x', true)) });
    expect(isPerfect(right(3))).toBe(true);
    expect(isPerfect({ day: 'd', questions: [q('a', 'x', true), q('b', 'x', true), q('c', 'x', false)] })).toBe(false);
    // A one-question day from before the quiz asked 3 never earns the bonus.
    expect(isPerfect(right(1))).toBe(false);
  });
});

describe('quizWaiting', () => {
  const today = '2026-10-05';
  it('waits when a module is mastered and today is not finished', () => {
    expect(quizWaiting(10, [], today)).toBe(true);
    expect(quizWaiting(10, [{ day: today, questions: [q('a', 'x', true), q('b'), q('c')] }], today)).toBe(true);
  });

  it('stops waiting once today is finished, and never waits with nothing mastered', () => {
    const done = { day: today, questions: [q('a', 'x', true), q('b', 'x', false), q('c', 'x', true)] };
    expect(quizWaiting(10, [done], today)).toBe(false);
    expect(quizWaiting(0, [], today)).toBe(false);
  });

  it('waits again on the next day', () => {
    const done = { day: today, questions: [q('a', 'x', true)] };
    expect(quizWaiting(10, [done], '2026-10-06')).toBe(true);
  });
});

describe('popupDue', () => {
  const base: PopupInputs = {
    prefs: { off: false, hiddenDay: null },
    today: '2026-10-05',
    waiting: true,
    openPending: true,
    otherMomentShowing: false,
  };

  it('shows for a fresh open while the quiz is waiting', () => {
    expect(popupDue(base)).toBe(true);
  });

  it('stays away when the quiz is not waiting, or the open already used its chance', () => {
    expect(popupDue({ ...base, waiting: false })).toBe(false);
    expect(popupDue({ ...base, openPending: false })).toBe(false);
  });

  it('waits for any other moment', () => {
    expect(popupDue({ ...base, otherMomentShowing: true })).toBe(false);
  });

  it('respects "Hide for today" for that day only, and "Don\'t show this again" for good', () => {
    expect(popupDue({ ...base, prefs: { off: false, hiddenDay: '2026-10-05' } })).toBe(false);
    expect(popupDue({ ...base, prefs: { off: false, hiddenDay: '2026-10-04' } })).toBe(true);
    expect(popupDue({ ...base, prefs: { off: true, hiddenDay: null } })).toBe(false);
  });
});
