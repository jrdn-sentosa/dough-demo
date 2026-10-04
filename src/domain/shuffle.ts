/** Fisher-Yates. Returns a new array. `random` returns a number in [0, 1), so tests can pass their own. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ShuffledChoice {
  /**
   * The choice's id: its index in the content file, whatever place it is shown in.
   * Answers are stored by id, so grading, saved attempts, and links never depend on order.
   */
  id: number;
  label: string;
}

export interface ShuffledQuestion<Q> {
  question: Q;
  choices: ShuffledChoice[];
}

/** A fresh order for the questions and for each question's choices. Call it again for every attempt. */
export function shuffleQuiz<Q extends { choices: readonly string[] }>(
  questions: readonly Q[],
  random: () => number = Math.random,
): ShuffledQuestion<Q>[] {
  return shuffle(questions, random).map((question) => ({
    question,
    choices: shuffle(
      question.choices.map((label, id): ShuffledChoice => ({ id, label })),
      random,
    ),
  }));
}
