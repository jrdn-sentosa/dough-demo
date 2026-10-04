import { nowIso } from '../money/clock';
import type { QuizGrade } from '../domain/quiz';
import type { LoafId } from '../domain/types';
import type { DataAdapter } from './adapter';
import type { LessonProgress, QuizAttempt, QuizMode } from './types';

/** Marks a lesson watched. Saying it twice changes nothing: the first time and way are kept. */
export async function markLessonWatched(
  adapter: DataAdapter,
  loafId: LoafId,
  lessonId: string,
  how: LessonProgress['how'],
): Promise<void> {
  const data = await adapter.load();
  if (data.lessonProgress.some((p) => p.loafId === loafId && p.lessonId === lessonId)) return;
  data.lessonProgress.push({ loafId, lessonId, watchedAt: await nowIso(adapter), how });
  await adapter.save(data);
}

/** Saves one finished quiz. Every attempt is kept, so retries never overwrite earlier ones. */
export async function recordQuizAttempt(
  adapter: DataAdapter,
  loafId: LoafId,
  mode: QuizMode,
  grade: QuizGrade,
  answers: Readonly<Record<string, number | undefined>>,
): Promise<QuizAttempt> {
  const data = await adapter.load();
  const picked: Record<string, number> = {};
  for (const [id, choice] of Object.entries(answers)) if (choice !== undefined) picked[id] = choice;
  const attempt: QuizAttempt = {
    id: `quiz-${data.quizAttempts.length + 1}`,
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
