import { TEST_OUT_MIN_CORRECT } from './quiz';
import type { AccountType } from './types';

/** How a lesson shows on the lessons list. `known` rows are collapsed. */
export type LessonState = 'recommended' | 'known' | 'optional';

/** Why a lesson isn't required: an account the student has, a passing test-out, or a test-out answer they got right. */
export type LessonReason = 'account' | 'tested-out' | 'answered-right';

export interface LessonInfo {
  id: string;
  optionalFor: AccountType | null;
}

/** The part of a saved quiz attempt these rules need. */
export interface AttemptInfo {
  mode: 'test-out' | 'lesson';
  score: number;
  missedLessons: readonly string[];
}

export interface LessonRow {
  id: string;
  state: LessonState;
  reason: LessonReason | null;
}

export interface LessonPlan {
  rows: LessonRow[];
  /** Every lesson is optional: lead with the doing-focused copy and the way forward. */
  allOptional: boolean;
  /** The student failed the latest test-out, so the missed lessons are recommended. */
  reviewing: boolean;
}

const passedTestOut = (a: AttemptInfo) => a.mode === 'test-out' && a.score >= TEST_OUT_MIN_CORRECT;

export function hasTestedOut(attempts: readonly AttemptInfo[]): boolean {
  return attempts.some(passedTestOut);
}

/**
 * Saving setup opens after a normal quiz (any score: there is no pass gate for the
 * emergency fund) or after a passing test-out. A failed test-out doesn't unlock it.
 */
export function savingUnlocked(attempts: readonly AttemptInfo[]): boolean {
  return attempts.some((a) => a.mode === 'lesson' || passedTestOut(a));
}

/**
 * Decides how each lesson shows, oldest rule first:
 * 1. Passed a test-out: every lesson is optional.
 * 2. Failed the latest test-out: missed lessons are recommended, the rest are known.
 * 3. Otherwise a lesson is known when its `optionalFor` account is one the student has.
 */
export function lessonPlan(
  lessons: readonly LessonInfo[],
  accounts: readonly AccountType[] | null,
  attempts: readonly AttemptInfo[],
): LessonPlan {
  const row = (id: string, state: LessonState, reason: LessonReason | null): LessonRow => ({ id, state, reason });

  if (hasTestedOut(attempts)) {
    return { rows: lessons.map((l) => row(l.id, 'optional', 'tested-out')), allOptional: lessons.length > 0, reviewing: false };
  }

  const testOuts = attempts.filter((a) => a.mode === 'test-out');
  const latest = testOuts[testOuts.length - 1];
  const rows = latest
    ? lessons.map((l) =>
        latest.missedLessons.includes(l.id) ? row(l.id, 'recommended', null) : row(l.id, 'known', 'answered-right'),
      )
    : lessons.map((l) =>
        l.optionalFor !== null && accounts?.includes(l.optionalFor)
          ? row(l.id, 'known', 'account')
          : row(l.id, 'recommended', null),
      );
  return {
    rows,
    allOptional: rows.length > 0 && rows.every((r) => r.state !== 'recommended'),
    reviewing: latest !== undefined,
  };
}

/** The lesson after `currentId` that isn't collapsed as already known, or null when the quiz is next. */
export function nextLessonId(rows: readonly LessonRow[], currentId: string): string | null {
  const at = rows.findIndex((r) => r.id === currentId);
  const next = rows.slice(at + 1).find((r) => r.state !== 'known');
  return next ? next.id : null;
}

export const WATCHED_FRACTION = 0.9;

/** A lesson counts as watched once the video reaches 90%. */
export function reachedWatchThreshold(currentTime: number, duration: number): boolean {
  return Number.isFinite(duration) && duration > 0 && currentTime / duration >= WATCHED_FRACTION;
}
