import type { LoafId } from './types';

/** The daily quiz avoids the questions shown on the last three days it ran. */
export const AVOID_RECENT = 3;

/** One day's question. `choiceId` and `correct` stay null until the student answers. */
export interface DailyQuizEntry {
  /** Local day, `YYYY-MM-DD`. One entry per day. */
  day: string;
  loafId: LoafId;
  questionId: string;
  choiceId: string | null;
  correct: boolean | null;
}

/** A question the daily quiz can draw: any question from the quiz of a mastered loaf. */
export interface PoolQuestion {
  loafId: LoafId;
  id: string;
}

export const questionRef = (loafId: LoafId, questionId: string): string => `${loafId}/${questionId}`;

/** The entry for a day, if the quiz already ran. */
export function entryForDay(entries: readonly DailyQuizEntry[], day: string): DailyQuizEntry | null {
  return entries.find((e) => e.day === day) ?? null;
}

/**
 * Picks today's question at random from the pool, avoiding the last 3 questions shown. When the pool is too small
 * for that (3 questions or fewer), the avoid list shrinks, oldest first, so there is always a question to ask.
 * Null only when the pool is empty.
 */
export function pickDailyQuestion<Q extends PoolQuestion>(
  pool: readonly Q[],
  entries: readonly DailyQuizEntry[],
  random: () => number = Math.random,
): Q | null {
  if (pool.length === 0) return null;
  const recent = [...entries]
    .sort((a, b) => b.day.localeCompare(a.day))
    .slice(0, AVOID_RECENT)
    .map((e) => questionRef(e.loafId, e.questionId));
  for (let keep = recent.length; keep >= 0; keep--) {
    const avoid = new Set(recent.slice(0, keep));
    const options = pool.filter((q) => !avoid.has(questionRef(q.loafId, q.id)));
    if (options.length > 0) return options[Math.floor(random() * options.length)];
  }
  return null;
}
