import { describe, expect, it } from 'vitest';
import { drawQuiz } from './drawQuiz';

const bank = [
  { id: 'a1', lesson: 'a' },
  { id: 'a2', lesson: 'a' },
  { id: 'a3', lesson: 'a' },
  { id: 'b1', lesson: 'b' },
  { id: 'b2', lesson: 'b' },
  { id: 'b3', lesson: 'b' },
  { id: 'b4', lesson: 'b' },
  { id: 'c1', lesson: 'c' },
  { id: 'c2', lesson: 'c' },
  { id: 'c3', lesson: 'c' },
];

/** A repeatable "random": a small linear generator, so a test can try many different draws. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('drawQuiz', () => {
  it('draws the asked-for number of different questions', () => {
    const drawn = drawQuiz(bank, 5, seeded(1));
    expect(drawn).toHaveLength(5);
    expect(new Set(drawn.map((q) => q.id)).size).toBe(5);
  });

  it('always includes at least one question from every lesson, over many draws', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const lessons = new Set(drawQuiz(bank, 5, seeded(seed)).map((q) => q.lesson));
      expect([...lessons].sort(), `seed ${seed}`).toEqual(['a', 'b', 'c']);
    }
  });

  it('does not always draw the same questions', () => {
    const sets = new Set<string>();
    for (let seed = 1; seed <= 100; seed++) {
      sets.add(drawQuiz(bank, 5, seeded(seed)).map((q) => q.id).join(','));
    }
    expect(sets.size).toBeGreaterThan(10);
  });

  it('can reach every question in the bank', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) for (const q of drawQuiz(bank, 5, seeded(seed))) seen.add(q.id);
    expect(seen.size).toBe(bank.length);
  });

  it('keeps the bank order, because the quiz screen shuffles afterwards', () => {
    const drawn = drawQuiz(bank, 5, seeded(7)).map((q) => bank.indexOf(q));
    expect(drawn).toEqual([...drawn].sort((x, y) => x - y));
  });

  it('draws exactly one per lesson when the count equals the number of lessons', () => {
    const drawn = drawQuiz(bank, 3, seeded(3));
    expect(drawn.map((q) => q.lesson)).toEqual(['a', 'b', 'c']);
  });

  it('draws the whole bank when asked for all of it', () => {
    expect(drawQuiz(bank, bank.length, seeded(2))).toEqual(bank);
  });

  it('refuses a count that cannot cover every lesson, or is bigger than the bank', () => {
    expect(() => drawQuiz(bank, 2)).toThrow(RangeError);
    expect(() => drawQuiz(bank, 11)).toThrow(RangeError);
    expect(() => drawQuiz(bank, 4.5)).toThrow(RangeError);
  });

  it('does not change the bank', () => {
    const copy = [...bank];
    drawQuiz(bank, 5, seeded(9));
    expect(bank).toEqual(copy);
  });
});
