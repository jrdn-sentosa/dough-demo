import { essentialsBand, savingsBand } from './bands';

const FIFTY_DOLLARS = 5_000;

export interface EssentialsFigure {
  /**
   * Monthly essentials in cents, already rounded up to the nearest $50.
   * Null when unknown ("Not sure", or the question was skipped): never a guess.
   */
  cents: number | null;
  /** Open-ended band without an exact amount: ask the student to type one. */
  needsExactInput: boolean;
}

export function roundUpToFifty(cents: number): number {
  return Math.ceil(cents / FIFTY_DOLLARS) * FIFTY_DOLLARS;
}

/**
 * Monthly essentials as a dollar figure: the band midpoint rounded up to $50.
 * Open-ended band: lower bound, unless the student typed an exact amount.
 * "Not sure": unknown (`cents: null`). The starter goal is `DEFAULT_GOAL_CENTS`.
 */
export function essentialsFigure(bandId: string, exactCents?: number): EssentialsFigure {
  const band = essentialsBand(bandId);
  if (band.kind === 'unsure') return { cents: null, needsExactInput: false };
  if (band.kind === 'open') {
    const typed = exactCents !== undefined && exactCents > 0;
    return {
      cents: roundUpToFifty(typed ? exactCents : band.minCents),
      needsExactInput: !typed,
    };
  }
  const midpoint = (band.minCents + (band.maxCents as number)) / 2;
  return { cents: roundUpToFifty(midpoint), needsExactInput: false };
}

export type TargetMonths = 1 | 3 | 6;

export function targetForMonths(monthlyEssentialsCents: number, months: TargetMonths): number {
  return monthlyEssentialsCents * months;
}

/** How many months of essentials a target covers. Used to label bakes and to pick the next loaf. */
export function monthsForTarget(targetCents: number, monthlyEssentialsCents: number): number {
  return monthlyEssentialsCents > 0 ? targetCents / monthlyEssentialsCents : 0;
}

/** Existing savings credited at the band's lower bound, unless an exact amount is given. */
export function creditedSavings(bandId: string, exactCents?: number): number {
  if (exactCents !== undefined && exactCents >= 0) return exactCents;
  return savingsBand(bandId).minCents;
}

/** True when savings already meet the target, so the UI suggests a bigger target. */
export function savingsMeetTarget(creditedCents: number, targetCents: number): boolean {
  return targetCents > 0 && creditedCents >= targetCents;
}

export interface GrowGoal {
  /** Essentials are unknown: ask "To size your 3-month goal, about how much do you need each month?" first. */
  needsEssentials: boolean;
  /** The 3-month goal, or null until essentials are known. */
  targetCents: number | null;
}

/** The target for "Grow your cushion to 3 months" (or "Grow to 6 months"). */
export function growGoal(essentialsCents: number | null, months: 3 | 6 = 3): GrowGoal {
  if (essentialsCents === null || essentialsCents <= 0) return { needsEssentials: true, targetCents: null };
  return { needsEssentials: false, targetCents: targetForMonths(essentialsCents, months) };
}
