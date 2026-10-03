import type { Stage } from './types';

export const STAGES: readonly Stage[] = ['mix', 'shape', 'proof', 'bake', 'baked'];

/** Whole percent of the target reached, clamped to 0-100. A zero target is 0. */
export function progressPercent(balanceCents: number, targetCents: number): number {
  if (targetCents <= 0 || balanceCents <= 0) return 0;
  return Math.min(100, Math.floor((balanceCents * 100) / targetCents));
}

export function stageForPercent(percent: number): Stage {
  if (percent >= 100) return 'baked';
  if (percent >= 75) return 'bake';
  if (percent >= 50) return 'proof';
  if (percent >= 25) return 'shape';
  return 'mix';
}

/** Used for deposits and withdrawals alike, so the loaf shrinks with the balance. */
export function stageForBalance(balanceCents: number, targetCents: number): Stage {
  return stageForPercent(progressPercent(balanceCents, targetCents));
}
