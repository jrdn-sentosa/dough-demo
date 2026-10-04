import { describe, expect, it } from 'vitest';
import { getQuiz } from '../../content/loader';
import { pickDailyQuestions, type DailyQuizEntry } from '../../domain/dailyQuiz';
import { dailyPool } from './dailyQuiz';

const quiz = getQuiz('emergency-fund');
const attempt = (score: number) => ({ loafId: 'emergency-fund' as const, mode: 'lesson' as const, score, total: 5 });

describe('the daily quiz pool', () => {
  it('is the whole question bank of a mastered module, not just the 5 an attempt asks', () => {
    const pool = dailyPool({ quizAttempts: [{ ...attempt(4), id: 'a', answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' }] });
    expect(quiz.questions).toHaveLength(10);
    expect(pool.map((q) => q.id)).toEqual(quiz.questions.map((q) => q.id));
    expect(pool.length).toBeGreaterThan(quiz.draw);
  });

  it('is empty until a module is mastered', () => {
    const attempts = [{ ...attempt(3), id: 'a', answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' }];
    expect(dailyPool({ quizAttempts: attempts })).toEqual([]);
  });

  it('can ask any question in the bank over time, avoiding the previous 2 days', () => {
    const pool = dailyPool({ quizAttempts: [{ ...attempt(5), id: 'a', answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' }] });
    let seed = 7;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    const entries: DailyQuizEntry[] = [];
    const seen = new Set<string>();
    for (let day = 1; day <= 120; day++) {
      const picked = pickDailyQuestions(pool, entries, random);
      expect(picked, `day ${day}`).toHaveLength(3);
      expect(new Set(picked.map((q) => q.id)).size).toBe(3);
      // 10 questions leave 4 free after 2 days of 3, so the exclusion never has to shrink.
      const recent = entries.slice(-2).flatMap((e) => e.questions.map((q) => q.questionId));
      for (const q of picked) {
        expect(recent, `day ${day}`).not.toContain(q.id);
        seen.add(q.id);
      }
      entries.push({
        day: `2026-01-${String(day).padStart(3, '0')}`,
        questions: picked.map((q) => ({ loafId: q.loafId, questionId: q.id, choiceId: null, correct: null })),
      });
    }
    expect(seen.size).toBe(quiz.questions.length);
  });
});
