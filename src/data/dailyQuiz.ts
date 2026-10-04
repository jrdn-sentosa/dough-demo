import {
  entryForDay,
  isFinished,
  isPerfect,
  pickDailyQuestions,
  type DailyQuizEntry,
  type PoolQuestion,
} from '../domain/dailyQuiz';
import { localDayKey } from '../domain/days';
import { pointEvent, quizBonusKey, quizKey } from '../domain/points';
import type { LoafId } from '../domain/types';
import { nowFromData } from '../money/clock';
import type { DataAdapter } from './adapter';
import { addToLedger, serialized } from './points';

/**
 * Today's daily quiz entry, picking and saving its questions the first time it is asked for today, so reloading
 * the page never changes them. Null when the pool is empty (no module is mastered yet).
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
    const questions = pickDailyQuestions(pool, data.dailyQuizzes, random);
    if (questions.length === 0) return null;
    const entry: DailyQuizEntry = {
      day,
      questions: questions.map((q) => ({ loafId: q.loafId, questionId: q.id, choiceId: null, correct: null })),
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

export interface DailyAnswerResult {
  correct: boolean;
  entry: DailyQuizEntry;
  /** Points this answer earned: 0 until the last question, then 1 for finishing and 1 more when all were right. */
  earned: number;
}

/**
 * Saves one answer of today's quiz, once. Answering the last question finishes the quiz and earns 1 point (key
 * `quiz:<day>`), plus 1 more (`quiz-bonus:<day>`) when every question was right. A question that already has an
 * answer changes nothing, so there is one try a day. Returns null when there is nothing to answer.
 */
export function answerDailyQuestion(
  adapter: DataAdapter,
  question: DailyAnswer,
  choiceId: string,
): Promise<DailyAnswerResult | null> {
  return serialized(async () => {
    const data = await adapter.load();
    const now = nowFromData(data);
    const day = localDayKey(now);
    const entry = entryForDay(data.dailyQuizzes, day);
    const asked = entry?.questions.find((q) => q.loafId === question.loafId && q.questionId === question.questionId);
    if (!entry || !asked) return null;
    if (asked.choiceId !== null) return { correct: asked.correct === true, entry, earned: 0 };

    asked.choiceId = choiceId;
    asked.correct = choiceId === question.answer;
    let earned = 0;
    if (isFinished(entry)) {
      const at = now.toISOString();
      const events = [pointEvent('quiz', quizKey(day), day, at)];
      if (isPerfect(entry)) events.push(pointEvent('quiz-bonus', quizBonusKey(day), day, at));
      earned = addToLedger(data, events).reduce((sum, e) => sum + e.points, 0);
    }
    await adapter.save(data);
    return { correct: asked.correct, entry, earned };
  });
}
