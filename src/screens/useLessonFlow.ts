import { useMemo } from 'react';
import { useData } from '../app/DataProvider';
import { getLessons, getLoaf } from '../content/loader';
import type { FlowContent, Lesson } from '../content/types';
import { lessonPlan, savingUnlocked } from '../domain/lessons';
import type { LessonPlan } from '../domain/lessons';
import { isMastered } from '../domain/mastery';
import type { LoafId } from '../domain/types';
import type { LessonProgress, QuizAttempt } from '../data/types';

const NO_ATTEMPTS: readonly QuizAttempt[] = [];
const NO_PROGRESS: readonly LessonProgress[] = [];

/** The only built loaf in the demo. */
export const FLOW_LOAF: LoafId = 'emergency-fund';

export interface LessonFlow {
  loafId: LoafId;
  flow: FlowContent;
  lessons: Lesson[];
  plan: LessonPlan;
  /** Lesson ids the student has watched. */
  watched: ReadonlySet<string>;
  unlocked: boolean;
  /** Best normal-quiz score is 4 out of 5 or more. Worked out from saved attempts. */
  mastered: boolean;
  draft: boolean;
}

/** Everything the lessons list, lesson screen and quiz share: copy, lessons, and how each lesson shows for this student. */
export function useLessonFlow(): LessonFlow {
  const { data } = useData();
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('the lesson flow needs a built loaf');
  const lessons = useMemo(() => getLessons(FLOW_LOAF), []);
  const attempts = data?.quizAttempts ?? NO_ATTEMPTS;
  const accounts = data?.profile?.accounts ?? null;
  const plan = useMemo(() => lessonPlan(lessons, accounts, attempts), [lessons, accounts, attempts]);
  const progress = data?.lessonProgress ?? NO_PROGRESS;
  const watched = useMemo(
    () => new Set(progress.filter((p) => p.loafId === FLOW_LOAF).map((p) => p.lessonId)),
    [progress],
  );
  return {
    loafId: FLOW_LOAF,
    flow: loaf.flow,
    lessons,
    plan,
    watched,
    unlocked: savingUnlocked(attempts),
    mastered: isMastered(attempts, FLOW_LOAF),
    draft: loaf.draft || lessons.some((l) => l.draft),
  };
}
