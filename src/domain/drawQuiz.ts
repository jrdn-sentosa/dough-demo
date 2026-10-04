import { shuffle } from './shuffle';

/**
 * Draws the questions for one quiz attempt from the bank: `count` of them, with at least one from every lesson,
 * so a missed question can send the student to any lesson. One question is picked at random from each lesson,
 * then the rest are picked at random from what is left. The result keeps the bank's order; the quiz screen
 * shuffles it afterwards (`shuffleQuiz`). `random` returns a number in [0, 1), so tests can pass their own.
 */
export function drawQuiz<Q extends { lesson: string }>(
  bank: readonly Q[],
  count: number,
  random: () => number = Math.random,
): Q[] {
  const lessons = [...new Set(bank.map((q) => q.lesson))];
  if (!Number.isInteger(count) || count < lessons.length || count > bank.length) {
    throw new RangeError(`cannot draw ${count} questions from ${bank.length} across ${lessons.length} lessons`);
  }
  const chosen = new Set<Q>();
  for (const lesson of lessons) {
    const options = bank.filter((q) => q.lesson === lesson);
    chosen.add(options[Math.floor(random() * options.length)]);
  }
  const rest = shuffle(
    bank.filter((q) => !chosen.has(q)),
    random,
  ).slice(0, count - chosen.size);
  for (const q of rest) chosen.add(q);
  return bank.filter((q) => chosen.has(q));
}
