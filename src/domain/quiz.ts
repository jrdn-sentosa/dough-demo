import type { LoafId } from './types';

export interface GradableQuestion {
  id: string;
  /** The id of the correct choice. */
  answer: string;
  explain: string;
  lesson: string;
  timestamp: number;
}

export interface QuestionResult {
  id: string;
  correct: boolean;
  /** The id of the choice the student picked, or null when unanswered. */
  chosen: string | null;
  explain: string;
  lesson: string;
  timestamp: number;
}

export interface QuizGrade {
  score: number;
  total: number;
  results: QuestionResult[];
  missed: QuestionResult[];
}

/** Unanswered questions count as missed. */
export function gradeQuiz(
  questions: readonly GradableQuestion[],
  /** Question id to the id of the picked choice. */
  answers: Readonly<Record<string, string | undefined>>,
): QuizGrade {
  const results = questions.map((q): QuestionResult => {
    const chosen = answers[q.id] ?? null;
    return {
      id: q.id,
      correct: chosen === q.answer,
      chosen,
      explain: q.explain,
      lesson: q.lesson,
      timestamp: q.timestamp,
    };
  });
  return {
    score: results.filter((r) => r.correct).length,
    total: results.length,
    results,
    missed: results.filter((r) => !r.correct),
  };
}

/** "Already know this? Take the quiz first": 4 of 5 or more makes the videos optional. */
export const TEST_OUT_MIN_CORRECT = 4;

export interface TestOutResult {
  passed: boolean;
  /** Lessons to recommend, in quiz order, one per lesson. Empty when passed. */
  recommendedLessons: string[];
}

export function evaluateTestOut(grade: QuizGrade): TestOutResult {
  if (grade.score >= TEST_OUT_MIN_CORRECT) return { passed: true, recommendedLessons: [] };
  const lessons = grade.missed.map((r) => r.lesson);
  return { passed: false, recommendedLessons: [...new Set(lessons)] };
}

const INVESTING_LOAVES: readonly LoafId[] = ['index-funds', 'bonds', 'roth-ira'];

/** Percent of the quiz needed to continue. The emergency fund has no pass gate. */
export function requiredPercentFor(loaf: LoafId): number {
  return INVESTING_LOAVES.includes(loaf) ? 80 : 0;
}

/** Applies to everyone, including students who tested out of the videos. */
export function meetsRequiredPercent(grade: QuizGrade, requiredPercent: number): boolean {
  return grade.total > 0 && grade.score * 100 >= grade.total * requiredPercent;
}
