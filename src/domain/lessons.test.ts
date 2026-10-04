import { describe, expect, it } from 'vitest';
import { hasTestedOut, lessonPlan, nextLessonId, reachedWatchThreshold, savingUnlocked } from './lessons';
import type { AttemptInfo, LessonInfo } from './lessons';

const lessons: LessonInfo[] = [
  { id: 'a', optionalFor: null },
  { id: 'b', optionalFor: null },
  { id: 'c', optionalFor: 'high-yield-savings' },
];
const testOut = (score: number, missedLessons: string[] = []): AttemptInfo => ({ mode: 'test-out', score, missedLessons });
const normal = (score: number): AttemptInfo => ({ mode: 'lesson', score, missedLessons: [] });
const states = (plan: ReturnType<typeof lessonPlan>) => plan.rows.map((r) => r.state);

describe('lessonPlan', () => {
  it('recommends every lesson by default', () => {
    const plan = lessonPlan(lessons, ['checking'], []);
    expect(states(plan)).toEqual(['recommended', 'recommended', 'recommended']);
    expect(plan.allOptional).toBe(false);
  });

  it('collapses a lesson as known when the student has the account it is optional for', () => {
    const plan = lessonPlan(lessons, ['checking', 'high-yield-savings'], []);
    expect(states(plan)).toEqual(['recommended', 'recommended', 'known']);
    expect(plan.rows[2].reason).toBe('account');
    expect(plan.allOptional).toBe(false);
  });

  it('treats unknown accounts as no account', () => {
    expect(states(lessonPlan(lessons, null, []))).toEqual(['recommended', 'recommended', 'recommended']);
  });

  it('makes every lesson optional after a passing test-out', () => {
    const plan = lessonPlan(lessons, [], [testOut(4, ['b'])]);
    expect(states(plan)).toEqual(['optional', 'optional', 'optional']);
    expect(plan.allOptional).toBe(true);
    expect(plan.reviewing).toBe(false);
  });

  it('recommends the missed lessons after a failed test-out, and collapses the rest', () => {
    const plan = lessonPlan(lessons, ['high-yield-savings'], [testOut(2, ['a', 'c'])]);
    expect(states(plan)).toEqual(['recommended', 'known', 'recommended']);
    expect(plan.rows[1].reason).toBe('answered-right');
    expect(plan.reviewing).toBe(true);
    expect(plan.allOptional).toBe(false);
  });

  it('uses the latest test-out when there are several', () => {
    const plan = lessonPlan(lessons, [], [testOut(1, ['a', 'b', 'c']), testOut(3, ['b'])]);
    expect(states(plan)).toEqual(['known', 'recommended', 'known']);
  });

  it('a pass beats an earlier failure', () => {
    expect(lessonPlan(lessons, [], [testOut(1, ['a']), testOut(5)]).allOptional).toBe(true);
  });
});

describe('savingUnlocked and hasTestedOut', () => {
  it('stays locked with no attempts or only a failed test-out', () => {
    expect(savingUnlocked([])).toBe(false);
    expect(savingUnlocked([testOut(3, ['a'])])).toBe(false);
  });

  it('unlocks after a passing test-out', () => {
    expect(savingUnlocked([testOut(4)])).toBe(true);
    expect(hasTestedOut([testOut(4)])).toBe(true);
  });

  it('unlocks after a normal quiz at any score, since there is no pass gate', () => {
    expect(savingUnlocked([normal(0)])).toBe(true);
    expect(hasTestedOut([normal(5)])).toBe(false);
  });
});

describe('nextLessonId', () => {
  it('moves through the lessons in order and then to the quiz', () => {
    const rows = lessonPlan(lessons, [], []).rows;
    expect(nextLessonId(rows, 'a')).toBe('b');
    expect(nextLessonId(rows, 'c')).toBeNull();
  });

  it('skips lessons collapsed as known', () => {
    const rows = lessonPlan(lessons, ['high-yield-savings'], []).rows;
    expect(nextLessonId(rows, 'b')).toBeNull();
  });

  it('goes through optional lessons when everything is optional', () => {
    const rows = lessonPlan(lessons, [], [testOut(5)]).rows;
    expect(nextLessonId(rows, 'a')).toBe('b');
  });
});

describe('reachedWatchThreshold', () => {
  it('is true from 90% on', () => {
    expect(reachedWatchThreshold(89, 100)).toBe(false);
    expect(reachedWatchThreshold(90, 100)).toBe(true);
    expect(reachedWatchThreshold(100, 100)).toBe(true);
  });

  it('is false when the duration is not known yet', () => {
    expect(reachedWatchThreshold(5, 0)).toBe(false);
    expect(reachedWatchThreshold(5, NaN)).toBe(false);
    expect(reachedWatchThreshold(5, Infinity)).toBe(false);
  });
});
