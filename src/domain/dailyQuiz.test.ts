import { describe, expect, it } from 'vitest';
import { pickDailyQuestion, type DailyQuizEntry, type PoolQuestion } from './dailyQuiz';

const pool = (n: number): PoolQuestion[] =>
  Array.from({ length: n }, (_, i) => ({ loafId: 'emergency-fund', id: `q${i + 1}` }));

const shown = (day: string, id: string): DailyQuizEntry => ({
  day,
  loafId: 'emergency-fund',
  questionId: id,
  choiceId: null,
  correct: null,
});

/** A "random" that always picks the first option, so the order of the pool decides. */
const first = () => 0;

describe('pickDailyQuestion', () => {
  it('is null for an empty pool (nothing mastered yet)', () => {
    expect(pickDailyQuestion([], [], first)).toBeNull();
  });

  it('avoids the last three questions shown', () => {
    const entries = [shown('2026-10-01', 'q1'), shown('2026-10-02', 'q2'), shown('2026-10-03', 'q3')];
    expect(pickDailyQuestion(pool(5), entries, first)?.id).toBe('q4');
    expect(pickDailyQuestion(pool(5), entries, () => 0.99)?.id).toBe('q5');
  });

  it('only counts the three most recent days', () => {
    const entries = [
      shown('2026-10-01', 'q1'),
      shown('2026-10-02', 'q2'),
      shown('2026-10-03', 'q3'),
      shown('2026-10-04', 'q4'),
    ];
    // q1 is more than three days back, so it is allowed again.
    expect(pickDailyQuestion(pool(4), entries, first)?.id).toBe('q1');
  });

  it('relaxes the avoid list, oldest first, when the pool is small', () => {
    const entries = [shown('2026-10-01', 'q1'), shown('2026-10-02', 'q2'), shown('2026-10-03', 'q3')];
    // Only 3 questions: q3 was shown last, so avoiding it as long as possible leaves q1 or q2.
    expect(pickDailyQuestion(pool(3), entries, first)?.id).toBe('q1');
    // A single-question pool still gets its question.
    expect(pickDailyQuestion(pool(1), [shown('2026-10-03', 'q1')], first)?.id).toBe('q1');
  });

  it('keeps questions from different loaves apart', () => {
    const mixed: PoolQuestion[] = [
      { loafId: 'emergency-fund', id: 'q1' },
      { loafId: 'index-funds', id: 'q1' },
    ];
    expect(pickDailyQuestion(mixed, [shown('2026-10-03', 'q1')], first)?.loafId).toBe('index-funds');
  });
});
