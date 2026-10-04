import type { BreadId, UnlockableBread } from '../domain/breads';
import type { DailyQuizEntry, PopupPrefs } from '../domain/dailyQuiz';
import type { PointEvent } from '../domain/points';
import type { Habit } from '../domain/habits';
import type { Profile } from '../domain/profile';
import type { LoafId } from '../domain/types';

/** `starting` is savings the student already had when they began the loaf. */
export type TransactionType = 'starting' | 'deposit' | 'withdrawal';

/** Where a row came from: typed in by the student, read from a linked bank (Plaid milestone), or demo seed data. */
export type TransactionSource = 'manual' | 'plaid' | 'seed';

export const TRANSACTION_SOURCES: readonly TransactionSource[] = ['manual', 'plaid', 'seed'];

/** One raw row. The amount is always positive; the sign comes from `type`. */
export interface Transaction {
  id: string;
  loafId: LoafId;
  type: TransactionType;
  source: TransactionSource;
  amountCents: number;
  /** ISO string in UTC, always taken from the demo clock. */
  at: string;
}

/** One bake on the shelf. A fund that has been grown has more than one. */
export interface Bake {
  /** The target that was reached. The shelf turns it into months using the student's essentials. */
  targetCents: number;
  /** ISO string in UTC from the demo clock, or null for "Already built" (existing savings covered it). */
  at: string | null;
  /** The bread this loaf was baked as, so the shelf shows each bake in its own look. */
  bread: BreadId;
}

export interface LoafRecord {
  loafId: LoafId;
  targetCents: number;
  startedAt: string;
  /** The bread look for the loaf as it rises now. Only changes when a student grows the loaf; older bakes keep theirs. */
  bread: BreadId;
  /**
   * Every bake, oldest first. Never cleared by withdrawals, so the shelf keeps
   * the first bake. A new entry is added only when a higher target is reached.
   */
  bakes: Bake[];
  /**
   * Set while the student grows a baked fund toward a bigger target: the old
   * target, where the new growth starts. Cleared by a withdrawal or the next bake.
   */
  growFromCents: number | null;
}

export interface ClockState {
  /** Whole days the demo clock has been moved forward from real time. */
  offsetDays: number;
}

/** Local-only fake sign-in. Replaced by Supabase auth in milestone 10. */
export interface LocalUser {
  email: string;
}

/** One lesson the student has watched: the video reached 90%, or they tapped "Mark as watched". */
export interface LessonProgress {
  loafId: LoafId;
  lessonId: string;
  /** ISO string in UTC, from the demo clock. */
  watchedAt: string;
  how: 'video' | 'manual';
}

/** `test-out` is "Already know this? Take the quiz first". `lesson` is the normal quiz, with feedback. */
export type QuizMode = 'test-out' | 'lesson';

export interface QuizAttempt {
  id: string;
  loafId: LoafId;
  mode: QuizMode;
  score: number;
  total: number;
  /** Question id to the id of the choice the student picked. */
  answers: Record<string, string>;
  /** Lessons covering the missed questions, in quiz order. Stored so the lessons list doesn't depend on later content changes. */
  missedLessons: string[];
  /** ISO string in UTC, from the demo clock. */
  at: string;
}

/**
 * The "Open a high-yield savings account" reminder on Home.
 * `pending` after "I'll do this later", `dismissed` once the student closes it, null when there is nothing to remind.
 */
export type HysaCardState = 'pending' | 'dismissed' | null;

/** A bread unlocked by a saving streak. Permanent. `seen` goes true once the student has dismissed the unlock moment on Home. */
export interface BreadUnlock {
  bread: UnlockableBread;
  /** ISO string in UTC, from the demo clock. */
  at: string;
  seen: boolean;
}

/**
 * What a streak has earned. The current streak itself is never stored: it is worked out from the habit and
 * the deposit rows. Unlocks never go away, and `bestDays` is the longest streak so far, in days covered.
 */
export interface Streaks {
  unlocked: BreadUnlock[];
  bestDays: number;
}

export interface AppData {
  version: 1;
  user: LocalUser | null;
  /** What placement stored. Null until placement is answered or skipped. */
  profile: Profile | null;
  loaves: LoafRecord[];
  transactions: Transaction[];
  lessonProgress: LessonProgress[];
  quizAttempts: QuizAttempt[];
  /** The saving habit from Saving setup. Null until it is picked (or skipped, which saves the suggested weekly amount). */
  habit: Habit | null;
  /** Ids of rising tips the student has opened (see `tipId`), so their "New" badge goes away. */
  tipsSeen: string[];
  hysaCard: HysaCardState;
  streaks: Streaks;
  /** The points ledger. Append-only: rows are only ever added, each with a unique key. */
  points: PointEvent[];
  /** One entry per day the daily quiz ran, with that day's questions. */
  dailyQuizzes: DailyQuizEntry[];
  /** The daily quiz popup preference: off for good, or hidden for one day. A flag, not money. */
  dailyQuizPopup: PopupPrefs;
  clock: ClockState;
}

export function emptyData(): AppData {
  return {
    version: 1,
    user: null,
    profile: null,
    loaves: [],
    transactions: [],
    lessonProgress: [],
    quizAttempts: [],
    habit: null,
    tipsSeen: [],
    hysaCard: null,
    streaks: { unlocked: [], bestDays: 0 },
    points: [],
    dailyQuizzes: [],
    dailyQuizPopup: { off: false, hiddenDay: null },
    clock: { offsetDays: 0 },
  };
}
