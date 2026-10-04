import { entryForDay, pickDailyQuestion, type DailyQuizEntry, type PoolQuestion } from '../domain/dailyQuiz';
import { localDayKey } from '../domain/days';
import { pointEvent, quizKey } from '../domain/points';
import type { LoafId } from '../domain/types';
import { nowFromData } from '../money/clock';
import type { DataAdapter } from './adapter';
import { addToLedger, serialized } from './points';

/**
 * Today's daily quiz entry, picking and saving the question the first time it is asked for today, so reloading
 * the page never changes it. Null when the pool is empty (no module is mastered yet).
 * The pool is passed in: the quiz questions come from content, which this folder doesn't read.
 */
export function startDailyQuiz<Q extends PoolQuestion>(
  adapter: DataAdapter,
  pool: readonly Q[],
  random?: () => number,
): Promise<DailyQuizEntry | null> {
  return serialized(async () => {
    const data = await adapter.load();
    const day = localDayKey(nowFromData(data));
    const existing = entryForDay(data.dailyQuizzes, day);
    if (existing) return existing;
    const question = pickDailyQuestion(pool, data.dailyQuizzes, random);
    if (!question) return null;
    const entry: DailyQuizEntry = {
      day,
      loafId: question.loafId,
      questionId: question.id,
      choiceId: null,
      correct: null,
    };
    data.dailyQuizzes.push(entry);
    await adapter.save(data);
    return entry;
  });
}

export interface DailyAnswer {
  loafId: LoafId;
  questionId: string;
  /** The id of the correct choice. */
  answer: string;
}

/**
 * Saves today's answer, once. A right answer earns 1 point (key `quiz:<day>`). Asking again after the day's
 * answer is in changes nothing, so there is one try a day. Returns null when there is nothing to answer.
 */
export function answerDailyQuiz(
  adapter: DataAdapter,
  question: DailyAnswer,
  choiceId: string,
): Promise<{ correct: boolean; entry: DailyQuizEntry } | null> {
  return serialized(async () => {
    const data = await adapter.load();
    const now = nowFromData(data);
    const day = localDayKey(now);
    const entry = entryForDay(data.dailyQuizzes, day);
    if (!entry || entry.loafId !== question.loafId || entry.questionId !== question.questionId) return null;
    if (entry.choiceId !== null) return { correct: entry.correct === true, entry };
    entry.choiceId = choiceId;
    entry.correct = choiceId === question.answer;
    if (entry.correct) addToLedger(data, [pointEvent('quiz', quizKey(day), day, now.toISOString())]);
    await adapter.save(data);
    return { correct: entry.correct, entry };
  });
}
