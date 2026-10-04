import { beforeEach, describe, expect, it } from 'vitest';
import type { PoolQuestion } from '../domain/dailyQuiz';
import { localDayKey } from '../domain/days';
import { advance, nowFromData } from '../money/clock';
import { answerDailyQuestion, startDailyQuiz } from './dailyQuiz';
import { hidePopupForToday, setPopupOff } from './dailyQuizPopup';
import type { DataAdapter } from './adapter';
import { createMemoryAdapter } from './memoryAdapter';
import { normalizeAppData } from './normalize';
import { emptyRows, fromRows, toRows } from './supabaseMapping';
import { emptyData } from './types';

const pool: PoolQuestion[] = Array.from({ length: 10 }, (_, i) => ({ loafId: 'emergency-fund', id: `q${i + 1}` }));
const first = () => 0;

let adapter: DataAdapter;

beforeEach(() => {
  adapter = createMemoryAdapter();
});

const answer = (id: string) => ({ loafId: 'emergency-fund' as const, questionId: id, answer: 'right' });

/** Starts today's quiz and answers every question with the given choices, in order. */
async function play(choices: string[]) {
  const entry = (await startDailyQuiz(adapter, pool, first))!;
  const results = [];
  for (const [i, choice] of choices.entries()) {
    results.push(await answerDailyQuestion(adapter, answer(entry.questions[i].questionId), choice));
  }
  return { entry, results };
}

describe('startDailyQuiz', () => {
  it('has nothing to ask with an empty pool, and saves nothing', async () => {
    expect(await startDailyQuiz(adapter, [], first)).toBeNull();
    expect((await adapter.load()).dailyQuizzes).toEqual([]);
  });

  it('saves 3 questions, and keeps the same ones for the whole day', async () => {
    const a = await startDailyQuiz(adapter, pool, first);
    const b = await startDailyQuiz(adapter, pool, () => 0.99);
    expect(a!.questions).toHaveLength(3);
    expect(b).toEqual(a);
    expect((await adapter.load()).dailyQuizzes).toHaveLength(1);
  });

  it('asks different questions on the next days, avoiding the previous 2 days', async () => {
    const days: string[][] = [];
    for (let day = 0; day < 4; day++) {
      const entry = await startDailyQuiz(adapter, pool, first);
      days.push(entry!.questions.map((q) => q.questionId));
      await advance(adapter, 1);
    }
    expect(new Set(days[0]).size).toBe(3);
    for (let i = 1; i < days.length; i++) {
      const recent = days.slice(Math.max(0, i - 2), i).flat();
      expect(days[i].filter((id) => recent.includes(id)), `day ${i}`).toEqual([]);
    }
  });
});

describe('answerDailyQuestion', () => {
  it('gives nothing until the last question is answered', async () => {
    await play(['right', 'right']);
    const data = await adapter.load();
    expect(data.points).toEqual([]);
    expect(data.dailyQuizzes[0].questions.filter((q) => q.choiceId !== null)).toHaveLength(2);
  });

  it('gives 1 point for finishing (key quiz:<day>) and 1 more for all right (quiz-bonus:<day>): 2 at most', async () => {
    const { entry, results } = await play(['right', 'right', 'right']);
    expect(results.map((r) => r!.earned)).toEqual([0, 0, 2]);
    const data = await adapter.load();
    expect(data.points.map((p) => [p.kind, p.key, p.points]).sort()).toEqual([
      ['quiz', `quiz:${entry.day}`, 1],
      ['quiz-bonus', `quiz-bonus:${entry.day}`, 1],
    ]);
  });

  it('gives only the finishing point when any answer is wrong, and still saves every answer', async () => {
    const { entry, results } = await play(['right', 'wrong', 'right']);
    expect(results.map((r) => r!.correct)).toEqual([true, false, true]);
    expect(results[2]!.earned).toBe(1);
    const data = await adapter.load();
    expect(data.points.map((p) => p.key)).toEqual([`quiz:${entry.day}`]);
    expect(data.dailyQuizzes[0].questions.map((q) => q.choiceId)).toEqual(['right', 'wrong', 'right']);
  });

  it('gives the finishing point even when every answer is wrong', async () => {
    const { entry } = await play(['wrong', 'wrong', 'wrong']);
    expect((await adapter.load()).points.map((p) => p.key)).toEqual([`quiz:${entry.day}`]);
  });

  it('allows one try a day: a second answer to a question changes nothing, and points are never doubled', async () => {
    const { entry } = await play(['wrong', 'right', 'right']);
    const again = await answerDailyQuestion(adapter, answer(entry.questions[0].questionId), 'right');
    expect(again).toMatchObject({ correct: false, earned: 0 });
    const data = await adapter.load();
    expect(data.dailyQuizzes[0].questions[0]).toMatchObject({ choiceId: 'wrong', correct: false });
    expect(data.points).toHaveLength(1);
  });

  it('ignores an answer for a question that is not one of today\'s', async () => {
    const entry = (await startDailyQuiz(adapter, pool, first))!;
    const asked = entry.questions.map((q) => q.questionId);
    const notAsked = pool.find((q) => !asked.includes(q.id))!;
    expect(await answerDailyQuestion(adapter, answer(notAsked.id), 'right')).toBeNull();
    expect((await adapter.load()).points).toEqual([]);
  });

  it('starts over the next day: the next quiz can earn its own points', async () => {
    await play(['right', 'right', 'right']);
    await advance(adapter, 1);
    await play(['right', 'right', 'right']);
    expect((await adapter.load()).points).toHaveLength(4);
  });
});

describe('a day saved when the quiz asked one question', () => {
  it('loads as a one-question day and keeps its answer', () => {
    const old = {
      ...emptyData(),
      dailyQuizzes: [{ day: '2026-01-04', loafId: 'emergency-fund', questionId: 'ef-q1', choiceId: 'car-repair', correct: true }],
    };
    const loaded = normalizeAppData(old as never);
    expect(loaded.dailyQuizzes).toEqual([
      { day: '2026-01-04', questions: [{ loafId: 'emergency-fund', questionId: 'ef-q1', choiceId: 'car-repair', correct: true }] },
    ]);
  });

  it('is dropped when it has no question, and a day is kept once', () => {
    const odd = {
      ...emptyData(),
      dailyQuizzes: [
        { day: '2026-01-04' },
        { day: '2026-01-05', questions: [] },
        { day: '2026-01-06', questions: [{ loafId: 'emergency-fund', questionId: 'a' }] },
        { day: '2026-01-06', questions: [{ loafId: 'emergency-fund', questionId: 'b' }] },
      ],
    };
    const loaded = normalizeAppData(odd as never);
    expect(loaded.dailyQuizzes.map((d) => d.day)).toEqual(['2026-01-06']);
    expect(loaded.dailyQuizzes[0].questions[0]).toEqual({ loafId: 'emergency-fund', questionId: 'a', choiceId: null, correct: null });
  });

  it('keeps old quiz points valid and never regrades the old day', async () => {
    const data = emptyData();
    data.points = [{ key: 'quiz:2026-01-04', kind: 'quiz', points: 1, at: '2026-01-04T10:00:00.000Z', ref: '2026-01-04' }];
    const loaded = normalizeAppData(data);
    expect(loaded.points).toHaveLength(1);
  });
});

describe('daily quiz rows in Supabase', () => {
  it('loads a row saved with one question (no `questions` list) as a one-question day', () => {
    const rows = emptyRows();
    rows.daily_quizzes = [
      { user_id: 'u', day: '2026-01-04', questions: null, loaf_id: 'emergency-fund', question_id: 'ef-q1', choice_id: 'car-repair', correct: true },
    ];
    expect(normalizeAppData(fromRows(rows, { email: 'a@b.co' })).dailyQuizzes).toEqual([
      { day: '2026-01-04', questions: [{ loafId: 'emergency-fund', questionId: 'ef-q1', choiceId: 'car-repair', correct: true }] },
    ]);
  });

  it('writes the questions as a list and leaves the one-question columns empty', () => {
    const data = emptyData();
    data.dailyQuizzes = [{ day: '2026-01-05', questions: [{ loafId: 'emergency-fund', questionId: 'ef-q2', choiceId: null, correct: null }] }];
    data.dailyQuizPopup = { off: true, hiddenDay: '2026-01-05' };
    const rows = toRows(data, 'u');
    expect(rows.daily_quizzes[0]).toMatchObject({ day: '2026-01-05', questions: data.dailyQuizzes[0].questions, loaf_id: null, question_id: null });
    expect(rows.user_state[0].daily_quiz_popup).toEqual({ off: true, hiddenDay: '2026-01-05' });
    // And it reads back the same.
    expect(normalizeAppData(fromRows(rows, { email: 'a@b.co' }))).toMatchObject({ dailyQuizzes: data.dailyQuizzes, dailyQuizPopup: data.dailyQuizPopup });
  });

  it('loads a user_state row from before the popup preference as on, with nothing hidden', () => {
    const rows = emptyRows();
    rows.user_state = [{ user_id: 'u', habit: null, tips_seen: [], hysa_card: null, streaks: { unlocked: [], bestDays: 0 }, clock_offset_days: 0 }];
    expect(normalizeAppData(fromRows(rows, { email: 'a@b.co' })).dailyQuizPopup).toEqual({ off: false, hiddenDay: null });
  });
});

describe('the popup preference', () => {
  it('starts on, with nothing hidden, also for data saved before it existed', async () => {
    expect((await adapter.load()).dailyQuizPopup).toEqual({ off: false, hiddenDay: null });
    const old = emptyData() as unknown as Record<string, unknown>;
    delete old.dailyQuizPopup;
    expect(normalizeAppData(old as never).dailyQuizPopup).toEqual({ off: false, hiddenDay: null });
  });

  it('"Hide for today" hides it for today (on the demo clock) only', async () => {
    await hidePopupForToday(adapter);
    const today = (await adapter.load()).dailyQuizPopup.hiddenDay;
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await advance(adapter, 1);
    // The saved day is yesterday now, so it no longer matches today's key (`popupDue` compares the two).
    const tomorrow = localDayKey(nowFromData(await adapter.load()));
    expect((await adapter.load()).dailyQuizPopup.hiddenDay).toBe(today);
    expect(tomorrow).not.toBe(today);
  });

  it('"Don\'t show this again" turns it off for good, and the Settings switch turns it back on', async () => {
    await setPopupOff(adapter, true);
    expect((await adapter.load()).dailyQuizPopup.off).toBe(true);
    await setPopupOff(adapter, false);
    expect((await adapter.load()).dailyQuizPopup).toEqual({ off: false, hiddenDay: null });
  });
});
