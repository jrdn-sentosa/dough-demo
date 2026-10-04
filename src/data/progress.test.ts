import { describe, expect, it } from 'vitest';
import { gradeQuiz } from '../domain/quiz';
import { createLocalAdapter } from './localAdapter';
import type { StorageLike } from './localAdapter';
import { createMemoryAdapter } from './memoryAdapter';
import { markLessonWatched, recordQuizAttempt } from './progress';

const questions = [
  { id: 'q1', answer: 1, explain: 'e1', lesson: 'l1', timestamp: 5 },
  { id: 'q2', answer: 0, explain: 'e2', lesson: 'l2', timestamp: 6 },
  { id: 'q3', answer: 2, explain: 'e3', lesson: 'l2', timestamp: 7 },
];

describe('markLessonWatched', () => {
  it('saves the lesson once, with how it was watched', async () => {
    const adapter = createMemoryAdapter();
    await markLessonWatched(adapter, 'emergency-fund', 'l1', 'video');
    await markLessonWatched(adapter, 'emergency-fund', 'l1', 'manual');
    const rows = (await adapter.load()).lessonProgress;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ loafId: 'emergency-fund', lessonId: 'l1', how: 'video' });
    expect(typeof rows[0].watchedAt).toBe('string');
  });

  it('takes the date from the demo clock', async () => {
    const adapter = createMemoryAdapter();
    const data = await adapter.load();
    data.clock.offsetDays = 10;
    await adapter.save(data);
    await markLessonWatched(adapter, 'emergency-fund', 'l1', 'manual');
    const at = new Date((await adapter.load()).lessonProgress[0].watchedAt).getTime();
    expect(at - Date.now()).toBeGreaterThan(9 * 24 * 60 * 60 * 1000);
  });
});

describe('recordQuizAttempt', () => {
  it('keeps every attempt, with the answers and the lessons for missed questions', async () => {
    const adapter = createMemoryAdapter();
    const first = { q1: 0, q2: 1, q3: 0 };
    await recordQuizAttempt(adapter, 'emergency-fund', 'test-out', gradeQuiz(questions, first), first);
    const second = { q1: 1, q2: 0, q3: 2 };
    await recordQuizAttempt(adapter, 'emergency-fund', 'lesson', gradeQuiz(questions, second), second);

    const attempts = (await adapter.load()).quizAttempts;
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ mode: 'test-out', score: 0, total: 3, answers: first, missedLessons: ['l1', 'l2'] });
    expect(attempts[1]).toMatchObject({ mode: 'lesson', score: 3, missedLessons: [] });
    expect(attempts[0].id).not.toBe(attempts[1].id);
  });
});

describe('older saved data', () => {
  it('loads with empty progress when it was saved before progress existed', async () => {
    const old = { version: 1, user: null, profile: null, loaves: [], transactions: [], clock: { offsetDays: 0 } };
    const store = new Map<string, string>([['dough:v1', JSON.stringify(old)]]);
    const storage: StorageLike = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => void store.set(k, v) };
    const data = await createLocalAdapter(storage).load();
    expect(data.lessonProgress).toEqual([]);
    expect(data.quizAttempts).toEqual([]);
  });
});
