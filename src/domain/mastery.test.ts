import { describe, expect, it } from 'vitest';
import { bestScore, isMastered, isMasteryScore } from './mastery';
import type { ScoredAttempt } from './mastery';
import { shuffle, shuffleQuiz } from './shuffle';
import { gradeQuiz } from './quiz';

const normal = (score: number, loafId: ScoredAttempt['loafId'] = 'emergency-fund'): ScoredAttempt => ({ loafId, mode: 'lesson', score, total: 5 });
const testOut = (score: number): ScoredAttempt => ({ loafId: 'emergency-fund', mode: 'test-out', score, total: 5 });

describe('mastery', () => {
  it('is not reached at 3 out of 5', () => {
    expect(isMasteryScore(3, 5)).toBe(false);
    expect(isMastered([normal(3)], 'emergency-fund')).toBe(false);
  });

  it('is reached at 4 and at 5 out of 5', () => {
    expect(isMastered([normal(4)], 'emergency-fund')).toBe(true);
    expect(isMastered([normal(5)], 'emergency-fund')).toBe(true);
  });

  it('is false with no attempts', () => {
    expect(bestScore([], 'emergency-fund')).toBeNull();
    expect(isMastered([], 'emergency-fund')).toBe(false);
  });

  it('uses the best score across attempts, and a later lower score keeps it', () => {
    const attempts = [normal(2), normal(5), normal(1)];
    expect(bestScore(attempts, 'emergency-fund')).toEqual({ score: 5, total: 5 });
    expect(isMastered(attempts, 'emergency-fund')).toBe(true);
    expect(bestScore([normal(1), normal(3), normal(2)], 'emergency-fund')).toEqual({ score: 3, total: 5 });
  });

  it('ignores test-out attempts, so a perfect test-out does not master the lessons', () => {
    expect(bestScore([testOut(5)], 'emergency-fund')).toBeNull();
    expect(isMastered([testOut(5), normal(3)], 'emergency-fund')).toBe(false);
    expect(bestScore([testOut(5), normal(3)], 'emergency-fund')).toEqual({ score: 3, total: 5 });
  });

  it('tracks each loaf on its own', () => {
    const attempts = [normal(5, 'index-funds'), normal(2)];
    expect(isMastered(attempts, 'emergency-fund')).toBe(false);
    expect(isMastered(attempts, 'index-funds')).toBe(true);
  });

  it('works for other quiz lengths by percent', () => {
    expect(isMasteryScore(8, 10)).toBe(true);
    expect(isMasteryScore(7, 10)).toBe(false);
    expect(isMasteryScore(0, 0)).toBe(false);
  });
});

describe('shuffling', () => {
  const questions = [
    { id: 'q1', choices: ['a', 'b', 'c'], answer: 1, explain: 'e1', lesson: 'l1', timestamp: 1 },
    { id: 'q2', choices: ['d', 'e', 'f'], answer: 0, explain: 'e2', lesson: 'l2', timestamp: 2 },
    { id: 'q3', choices: ['g', 'h', 'i'], answer: 2, explain: 'e3', lesson: 'l2', timestamp: 3 },
    { id: 'q4', choices: ['j', 'k', 'l'], answer: 2, explain: 'e4', lesson: 'l3', timestamp: 4 },
  ];
  const keepsOrder = () => 0.999999; // always swaps an item with itself
  const rotates = () => 0;

  it('changes the order of the questions and of the choices', () => {
    const same = shuffleQuiz(questions, keepsOrder);
    const moved = shuffleQuiz(questions, rotates);
    expect(same.map((s) => s.question.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(moved.map((s) => s.question.id)).not.toEqual(['q1', 'q2', 'q3', 'q4']);
    expect(moved[0].choices.map((c) => c.label)).not.toEqual(same[0].choices.map((c) => c.label));
  });

  it('keeps every question and every choice, with the choice id staying its index in the content', () => {
    const moved = shuffleQuiz(questions, rotates);
    expect(moved.map((s) => s.question.id).sort()).toEqual(['q1', 'q2', 'q3', 'q4']);
    for (const s of moved) {
      expect(s.choices.map((c) => c.id).sort()).toEqual([0, 1, 2]);
      for (const c of s.choices) expect(c.label).toBe(s.question.choices[c.id]);
    }
  });

  it('does not change the questions it was given', () => {
    const before = JSON.stringify(questions);
    shuffleQuiz(questions, rotates);
    expect(JSON.stringify(questions)).toBe(before);
  });

  it('grading still works when answers are picked by choice id from a shuffled screen', () => {
    const shown = shuffleQuiz(questions, rotates);
    const answers: Record<string, number> = {};
    for (const s of shown) {
      // Pick the choice that is shown with the right label, wherever it landed.
      const right = s.choices.find((c) => c.id === s.question.answer);
      if (!right) throw new Error('right choice missing');
      // Get q2 and q4 wrong by picking another choice.
      const wrong = s.choices.find((c) => c.id !== s.question.answer);
      answers[s.question.id] = ['q2', 'q4'].includes(s.question.id) ? (wrong as { id: number }).id : right.id;
    }
    const grade = gradeQuiz(questions, answers);
    expect(grade.score).toBe(2);
    expect(grade.missed.map((r) => r.id)).toEqual(['q2', 'q4']);
    expect(grade.missed.map((r) => r.lesson)).toEqual(['l2', 'l3']);
    expect(grade.missed.map((r) => r.timestamp)).toEqual([2, 4]);
  });

  it('gives different orders for different random sources', () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(shuffle(items, rotates)).not.toEqual(shuffle(items, keepsOrder));
    expect(shuffle(items, keepsOrder)).toEqual(items);
  });
});
