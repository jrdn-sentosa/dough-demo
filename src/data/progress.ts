import { nowIso } from '../money/clock';
import type { QuizGrade } from '../domain/quiz';
import type { LoafId } from '../domain/types';
import type { DataAdapter } from './adapter';
import { serialized } from './points';
import type { LessonProgress, QuizAttempt, QuizMode } from './types';

/**
 * Marks a lesson watched. Saying it twice changes nothing: the first time and way are kept.
 * It runs in the points queue because a video reaching 90% marks the lesson watched and earns its point in the
 * same moment, and two writes that load the same data would otherwise overwrite each other.
 */
export function markLessonWatched(
  adapter: DataAdapter,
  loafId: LoafId,
  lessonId: string,
  how: LessonProgress['how'],
): Promise<void> {
  return serialized(async () => {
    const data = await adapter.load();
    if (data.lessonProgress.some((p) => p.loafId === loafId && p.lessonId === lessonId)) return;
    data.lessonProgress.push({ loafId, lessonId, watchedAt: await nowIso(adapter), how });
    await adapter.save(data);
  });
}

/** Saves one finished quiz. Every attempt is kept, so retries never overwrite earlier ones. */
export async function recordQuizAttempt(
  adapter: DataAdapter,
  loafId: LoafId,
  mode: QuizMode,
  grade: QuizGrade,
  answers: Readonly<Record<string, string | undefined>>,
): Promise<QuizAttempt> {
  const data = await adapter.load();
  const picked: Record<string, string> = {};
  for (const [id, choice] of Object.entries(answers)) if (choice !== undefined) picked[id] = choice;
  const attempt: QuizAttempt = {
    id: crypto.randomUUID(),
    loafId,
    mode,
    score: grade.score,
    total: grade.total,
    answers: picked,
    missedLessons: [...new Set(grade.missed.map((r) => r.lesson))],
    at: await nowIso(adapter),
  };
  data.quizAttempts.push(attempt);
  await adapter.save(data);
  return attempt;
}
