import type { LoafId } from './types';

/** 4 out of 5 (80%) masters a loaf's lessons. Investing loaves use the same bar as their pass requirement. */
export const MASTERY_PERCENT = 80;

/** The part of a saved quiz attempt these rules need. */
export interface ScoredAttempt {
  loafId: LoafId;
  mode: 'test-out' | 'lesson';
  score: number;
  total: number;
}

export interface BestScore {
  score: number;
  total: number;
}

export function isMasteryScore(score: number, total: number): boolean {
  return total > 0 && score * 100 >= total * MASTERY_PERCENT;
}

/**
 * The best normal-quiz score for a loaf, worked out from saved attempts (nothing is stored).
 * Test-out attempts don't count: they are a quick check, not the quiz. Null when there are none.
 */
export function bestScore(attempts: readonly ScoredAttempt[], loafId: LoafId): BestScore | null {
  let best: BestScore | null = null;
  for (const a of attempts) {
    if (a.loafId !== loafId || a.mode !== 'lesson' || a.total <= 0) continue;
    if (best === null || a.score * best.total > best.score * a.total) best = { score: a.score, total: a.total };
  }
  return best;
}

/** True once any normal attempt reached 4 out of 5. A later lower score never takes it away. */
export function isMastered(attempts: readonly ScoredAttempt[], loafId: LoafId): boolean {
  const best = bestScore(attempts, loafId);
  return best !== null && isMasteryScore(best.score, best.total);
}
