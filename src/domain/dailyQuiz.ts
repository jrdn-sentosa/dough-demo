import { shuffle } from './shuffle';
import type { LoafId } from './types';

/** Questions asked a day. */
export const DAILY_QUESTIONS = 3;

/** The daily quiz avoids the questions shown on the last two days it ran, when the pool allows. */
export const AVOID_RECENT_DAYS = 2;

/** One question of a day's quiz. `choiceId` and `correct` stay null until the student answers it. */
export interface DailyQuestionEntry {
  loafId: LoafId;
  questionId: string;
  choiceId: string | null;
  correct: boolean | null;
}

/**
 * One day's quiz. Days saved when the quiz asked a single question load as a one-question entry, so the history stays valid.
 */
export interface DailyQuizEntry {
  /** Local day, `YYYY-MM-DD`. One entry per day. */
  day: string;
  questions: DailyQuestionEntry[];
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

/** Every question of the day has an answer. One try a day: after this nothing can be answered again. */
export function isFinished(entry: DailyQuizEntry | null): boolean {
  return entry !== null && entry.questions.length > 0 && entry.questions.every((q) => q.choiceId !== null);
}

/** The day's quiz was a full one and every question was answered right. Earns the extra point. */
export function isPerfect(entry: DailyQuizEntry): boolean {
  return entry.questions.length === DAILY_QUESTIONS && entry.questions.every((q) => q.correct === true);
}

/** Today's quiz is waiting: there are questions to draw from (a module is mastered) and today's isn't finished. */
export function quizWaiting(poolSize: number, entries: readonly DailyQuizEntry[], day: string): boolean {
  return poolSize > 0 && !isFinished(entryForDay(entries, day));
}

/**
 * Picks `count` different questions from the pool at random, avoiding the questions shown on the last two days the
 * quiz ran. When the pool is too small for that, the exclusion shrinks: questions from the older day come back
 * first, then the most recent day's, so there are always `count` questions unless the pool itself is smaller.
 */
export function pickDailyQuestions<Q extends PoolQuestion>(
  pool: readonly Q[],
  entries: readonly DailyQuizEntry[],
  random: () => number = Math.random,
  count: number = DAILY_QUESTIONS,
): Q[] {
  const recentDays = [...entries].sort((a, b) => b.day.localeCompare(a.day)).slice(0, AVOID_RECENT_DAYS);
  // 0 = not shown recently, 1 = shown on the older of the two days, 2 = shown on the most recent day.
  const tier = new Map<string, number>();
  recentDays.forEach((entry, i) => {
    for (const q of entry.questions) {
      const ref = questionRef(q.loafId, q.questionId);
      tier.set(ref, Math.max(tier.get(ref) ?? 0, recentDays.length - i));
    }
  });
  const tiers = [0, 1, 2].map((t) =>
    shuffle(
      pool.filter((q) => (tier.get(questionRef(q.loafId, q.id)) ?? 0) === t),
      random,
    ),
  );
  return tiers.flat().slice(0, count);
}

/** The popup preference. Plans and flags, never money. */
export interface PopupPrefs {
  /** "Don't show this again": off until the student turns it back on in Settings. */
  off: boolean;
  /** "Hide for today": the local day the popup stays closed on, or null. */
  hiddenDay: string | null;
}

export const DEFAULT_POPUP_PREFS: PopupPrefs = { off: false, hiddenDay: null };

export interface PopupInputs {
  prefs: PopupPrefs;
  /** Local day on the demo clock. */
  today: string;
  /** Today's quiz is waiting (see `quizWaiting`). */
  waiting: boolean;
  /** This app open hasn't used up its one chance yet (see `src/domain/appOpen.ts`). */
  openPending: boolean;
  /** Another moment is on screen: a bread unlock, a stage or withdrawal message, the high-yield reminder, an amount sheet or the update banner. */
  otherMomentShowing: boolean;
}

/** Whether the daily quiz popup shows now. It waits for any other moment, and never shows twice in one open. */
export function popupDue({ prefs, today, waiting, openPending, otherMomentShowing }: PopupInputs): boolean {
  if (prefs.off || prefs.hiddenDay === today) return false;
  return waiting && openPending && !otherMomentShowing;
}
