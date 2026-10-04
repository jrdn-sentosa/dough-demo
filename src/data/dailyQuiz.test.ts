import { beforeEach, describe, expect, it } from 'vitest';
import type { PoolQuestion } from '../domain/dailyQuiz';
import { advance } from '../money/clock';
import { answerDailyQuiz, startDailyQuiz } from './dailyQuiz';
import type { DataAdapter } from './adapter';
import { createMemoryAdapter } from './memoryAdapter';

const pool: PoolQuestion[] = ['q1', 'q2', 'q3', 'q4', 'q5'].map((id) => ({ loafId: 'emergency-fund', id }));
const first = () => 0;

let adapter: DataAdapter;

beforeEach(() => {
  adapter = createMemoryAdapter();
});

describe('startDailyQuiz', () => {
  it('has nothing to ask with an empty pool, and saves nothing', async () => {
    expect(await startDailyQuiz(adapter, [], first)).toBeNull();
    expect((await adapter.load()).dailyQuizzes).toEqual([]);
  });

  it('keeps the same question for the whole day, even if asked again', async () => {
    const a = await startDailyQuiz(adapter, pool, first);
    const b = await startDailyQuiz(adapter, pool, () => 0.99);
    expect(b).toEqual(a);
    expect((await adapter.load()).dailyQuizzes).toHaveLength(1);
  });

  it('picks a new question each day, avoiding the last three', async () => {
    const seen: string[] = [];
    for (let day = 0; day < 4; day++) {
      const entry = await startDailyQuiz(adapter, pool, first);
      seen.push(entry!.questionId);
      await advance(adapter, 1);
    }
    expect(seen).toEqual(['q1', 'q2', 'q3', 'q4']);
  });
});

describe('answerDailyQuiz', () => {
  const answer = (id: string) => ({ loafId: 'emergency-fund' as const, questionId: id, answer: 'right' });

  it('gives 1 point for a right answer, keyed by the day', async () => {
    const entry = await startDailyQuiz(adapter, pool, first);
    const result = await answerDailyQuiz(adapter, answer(entry!.questionId), 'right');
    expect(result?.correct).toBe(true);
    const data = await adapter.load();
    expect(data.points).toHaveLength(1);
    expect(data.points[0]).toMatchObject({ kind: 'quiz', key: `quiz:${entry!.day}`, points: 1 });
  });

  it('gives nothing for a wrong answer but still saves it', async () => {
    const entry = await startDailyQuiz(adapter, pool, first);
    const result = await answerDailyQuiz(adapter, answer(entry!.questionId), 'wrong');
    expect(result?.correct).toBe(false);
    const data = await adapter.load();
    expect(data.points).toEqual([]);
    expect(data.dailyQuizzes[0]).toMatchObject({ choiceId: 'wrong', correct: false });
  });

  it('allows one try a day: a second answer changes nothing', async () => {
    const entry = await startDailyQuiz(adapter, pool, first);
    await answerDailyQuiz(adapter, answer(entry!.questionId), 'wrong');
    const again = await answerDailyQuiz(adapter, answer(entry!.questionId), 'right');
    expect(again?.correct).toBe(false);
    expect((await adapter.load()).points).toEqual([]);
  });

  it('ignores an answer for a question that is not today\'s', async () => {
    await startDailyQuiz(adapter, pool, first);
    expect(await answerDailyQuiz(adapter, answer('q5'), 'right')).toBeNull();
    expect((await adapter.load()).points).toEqual([]);
  });
});
