import { describe, expect, it } from 'vitest';
import {
  evaluateTestOut,
  gradeQuiz,
  meetsRequiredPercent,
  requiredPercentFor,
} from './quiz';
import type { GradableQuestion } from './quiz';

const questions: GradableQuestion[] = [
  { id: 'q1', answer: 'b', explain: 'e1', lesson: 'ef-what-its-for', timestamp: 34 },
  { id: 'q2', answer: 'a', explain: 'e2', lesson: 'ef-what-its-for', timestamp: 50 },
  { id: 'q3', answer: 'c', explain: 'e3', lesson: 'ef-how-much', timestamp: 12 },
  { id: 'q4', answer: 'b', explain: 'e4', lesson: 'ef-where-to-keep', timestamp: 20 },
  { id: 'q5', answer: 'a', explain: 'e5', lesson: 'ef-how-much', timestamp: 70 },
];

const allRight = { q1: 'b', q2: 'a', q3: 'c', q4: 'b', q5: 'a' };

describe('gradeQuiz', () => {
  it('scores all correct', () => {
    const g = gradeQuiz(questions, allRight);
    expect(g.score).toBe(5);
    expect(g.total).toBe(5);
    expect(g.missed).toEqual([]);
  });

  it('returns explanation, lesson and timestamp for each missed question', () => {
    const g = gradeQuiz(questions, { ...allRight, q3: 'a' });
    expect(g.score).toBe(4);
    expect(g.missed).toEqual([
      { id: 'q3', correct: false, chosen: 'a', explain: 'e3', lesson: 'ef-how-much', timestamp: 12 },
    ]);
  });

  it('counts unanswered questions as missed', () => {
    const g = gradeQuiz(questions, { q1: 'b' });
    expect(g.score).toBe(1);
    expect(g.missed).toHaveLength(4);
    expect(g.results[1].chosen).toBeNull();
  });
});

describe('evaluateTestOut', () => {
  it('5 of 5 passes with no recommended lessons', () => {
    expect(evaluateTestOut(gradeQuiz(questions, allRight))).toEqual({
      passed: true,
      recommendedLessons: [],
    });
  });

  it('4 of 5 passes', () => {
    expect(evaluateTestOut(gradeQuiz(questions, { ...allRight, q4: 'a' })).passed).toBe(true);
  });

  it('3 of 5 fails and recommends the lessons for missed questions', () => {
    const t = evaluateTestOut(gradeQuiz(questions, { ...allRight, q1: 'a', q4: 'a' }));
    expect(t.passed).toBe(false);
    expect(t.recommendedLessons).toEqual(['ef-what-its-for', 'ef-where-to-keep']);
  });

  it('recommends each lesson once, in quiz order', () => {
    const t = evaluateTestOut(gradeQuiz(questions, {}));
    expect(t.recommendedLessons).toEqual(['ef-what-its-for', 'ef-how-much', 'ef-where-to-keep']);
  });
});

describe('required score', () => {
  it('emergency fund has no pass gate; investing loaves need 80%', () => {
    expect(requiredPercentFor('emergency-fund')).toBe(0);
    expect(requiredPercentFor('debt-payoff')).toBe(0);
    expect(requiredPercentFor('index-funds')).toBe(80);
    expect(requiredPercentFor('bonds')).toBe(80);
    expect(requiredPercentFor('roth-ira')).toBe(80);
  });

  it('4 of 5 meets 80%, 3 of 5 does not', () => {
    expect(meetsRequiredPercent(gradeQuiz(questions, { ...allRight, q1: 'a' }), 80)).toBe(true);
    expect(meetsRequiredPercent(gradeQuiz(questions, { ...allRight, q1: 'a', q2: 'b' }), 80)).toBe(false);
  });

  it('a 0% requirement passes any score, but not an empty quiz', () => {
    expect(meetsRequiredPercent(gradeQuiz(questions, {}), 0)).toBe(true);
    expect(meetsRequiredPercent(gradeQuiz([], {}), 0)).toBe(false);
  });
});
