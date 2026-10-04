import { getLoaf, getQuiz } from '../../content/loader';
import type { QuizQuestionContent } from '../../content/types';
import type { AppData } from '../../data/types';
import { quizWaiting, type PoolQuestion } from '../../domain/dailyQuiz';
import { localDayKey } from '../../domain/days';
import { isMastered } from '../../domain/mastery';
import { nowFromData } from '../../money/clock';

export interface DailyPoolQuestion extends PoolQuestion {
  question: QuizQuestionContent;
}

/**
 * The questions the daily quiz can ask: every question from the quiz of each mastered loaf.
 * Empty until a loaf's lessons are mastered, which keeps the quiz (and its popup and dot) away before then.
 */
export function dailyPool(data: Pick<AppData, 'quizAttempts'>): DailyPoolQuestion[] {
  const loafIds = [...new Set(data.quizAttempts.map((a) => a.loafId))];
  return loafIds
    .filter((id) => getLoaf(id).status === 'built' && isMastered(data.quizAttempts, id))
    .flatMap((loafId) => getQuiz(loafId).questions.map((question) => ({ loafId, id: question.id, question })));
}

/** Today's quiz (on the demo clock) can be taken and isn't finished yet. */
export function dailyQuizWaiting(data: Pick<AppData, 'quizAttempts' | 'dailyQuizzes' | 'clock'>): boolean {
  return quizWaiting(dailyPool(data).length, data.dailyQuizzes, localDayKey(nowFromData(data)));
}
