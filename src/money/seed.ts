import { getLessons, getQuiz } from '../content/loader';
import { emptyData } from '../data/types';
import type { AppData, Transaction } from '../data/types';
import { LADDER } from '../domain/breads';
import { profileFromAnswers } from '../domain/profile';
import { targetForMonths } from '../domain/targets';
import { DEMO_EMAIL } from '../data/session';

/**
 * Maya, the seeded demo user. Demo data only: nothing here is real, and the rows are marked `seed`.
 * Placement: checking and regular savings, no emergency savings at start, no retirement account, earned income, no card debt.
 * She watched the lessons and took the quiz (no test-out). Her emergency fund is at 60% ($240 of $400) from six
 * weekly deposits, so she has a 6-week streak. The unlocks that streak has already earned are marked seen, so
 * opening the demo doesn't show three unlock messages in a row; her next unlock shows normally.
 */

const EF = 'emergency-fund';
const DAY_MS = 24 * 60 * 60 * 1000;
export const MAYA_WEEKS = 6;
export const MAYA_WEEKLY_CENTS = 4000;
const ESSENTIALS_BAND = '250-499';

/** Builds Maya's data as of `now` (real time: her demo clock starts at no offset). */
export function mayaSeed(now: Date): AppData {
  const day = (offset: number) => new Date(now.getTime() + offset * DAY_MS).toISOString();
  const startDay = -MAYA_WEEKS * 7;
  const data = emptyData();
  data.user = { email: DEMO_EMAIL };
  data.profile = profileFromAnswers({
    essentials: ESSENTIALS_BAND,
    savings: 'none',
    accounts: ['checking', 'regular-savings'],
    cardDebt: 'no',
    earnedIncome: true,
  });

  // The band's midpoint rounded up to $50 is $400, so 1 month of essentials is a $400 goal.
  const targetCents = targetForMonths(data.profile.essentialsCents as number, 1);
  data.loaves.push({ loafId: EF, targetCents, startedAt: day(startDay), bread: 'sandwich', bakes: [], growFromCents: null });

  // One deposit a day after each week begins, so every week of the habit has a deposit.
  const deposits: Transaction[] = Array.from({ length: MAYA_WEEKS }, (_, week) => ({
    id: crypto.randomUUID(),
    loafId: EF,
    type: 'deposit',
    source: 'seed',
    amountCents: MAYA_WEEKLY_CENTS,
    at: day(startDay + week * 7 + 1),
  }));
  data.transactions = deposits;

  data.habit = { kind: 'weekly', amountCents: MAYA_WEEKLY_CENTS, paycheckCents: null, frequency: null, startedAt: day(startDay) };

  // Lessons watched, then the normal quiz: every answer right but the last.
  const quiz = getQuiz(EF);
  data.lessonProgress = getLessons(EF).map((lesson, i) => ({
    loafId: EF,
    lessonId: lesson.id,
    watchedAt: day(startDay + i),
    how: 'manual' as const,
  }));
  const answers: Record<string, string> = {};
  const missed: string[] = [];
  quiz.questions.forEach((q, i) => {
    if (i < quiz.questions.length - 1) {
      answers[q.id] = q.answer;
    } else {
      answers[q.id] = q.choices.find((c) => c.id !== q.answer)?.id ?? q.answer;
      missed.push(q.lesson);
    }
  });
  data.quizAttempts = [
    {
      id: crypto.randomUUID(),
      loafId: EF,
      mode: 'lesson',
      score: quiz.questions.length - 1,
      total: quiz.questions.length,
      answers,
      missedLessons: missed,
      at: day(startDay + 3),
    },
  ];

  // The breads six weeks of saving has earned, already seen. Dated when each rung was reached.
  const earned = LADDER.filter((rung) => rung.weeks <= MAYA_WEEKS);
  data.streaks = {
    unlocked: earned.map((rung) => ({ bread: rung.bread, at: day(startDay + rung.weeks * 7), seen: true })),
    bestDays: MAYA_WEEKS * 7,
  };
  return data;
}
