import { getLoaf, getQuiz } from '../../content/loader';
import type { QuizQuestionContent } from '../../content/types';
import type { AppData } from '../../data/types';
import type { PoolQuestion } from '../../domain/dailyQuiz';
import { isMastered } from '../../domain/mastery';

export interface DailyPoolQuestion extends PoolQuestion {
  question: QuizQuestionContent;
}

/**
 * The questions the daily quiz can ask: every question from the quiz of each mastered loaf.
 * Empty until a loaf's lessons are mastered, which is what keeps the card away before then.
 */
export function dailyPool(data: Pick<AppData, 'quizAttempts'>): DailyPoolQuestion[] {
  const loafIds = [...new Set(data.quizAttempts.map((a) => a.loafId))];
  return loafIds
    .filter((id) => getLoaf(id).status === 'built' && isMastered(data.quizAttempts, id))
    .flatMap((loafId) => getQuiz(loafId).questions.map((question) => ({ loafId, id: question.id, question })));
}
