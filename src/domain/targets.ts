import { essentialsBand, savingsBand } from './bands';

const FIFTY_DOLLARS = 5_000;

export interface EssentialsFigure {
  /** Monthly essentials in cents, already rounded up to the nearest $50. */
  cents: number;
  /** Open-ended band without an exact amount: ask the student to type one. */
  needsExactInput: boolean;
  /** "Not sure": the result screen says this is an estimate they can change. */
  isEstimate: boolean;
}

export function roundUpToFifty(cents: number): number {
  return Math.ceil(cents / FIFTY_DOLLARS) * FIFTY_DOLLARS;
}

/**
 * Monthly essentials as a dollar figure: the band midpoint rounded up to $50.
 * Open-ended band: lower bound, unless the student typed an exact amount.
 * "Not sure": $500 starter, flagged as an estimate.
 */
export function essentialsFigure(bandId: string, exactCents?: number): EssentialsFigure {
  const band = essentialsBand(bandId);
  if (band.kind === 'unsure') {
    return { cents: band.minCents, needsExactInput: false, isEstimate: true };
  }
  if (band.kind === 'open') {
    const typed = exactCents !== undefined && exactCents > 0;
    return {
      cents: roundUpToFifty(typed ? exactCents : band.minCents),
      needsExactInput: !typed,
      isEstimate: false,
    };
  }
  const midpoint = (band.minCents + (band.maxCents as number)) / 2;
  return { cents: roundUpToFifty(midpoint), needsExactInput: false, isEstimate: false };
}

export type TargetMonths = 1 | 3 | 6;

export function targetForMonths(monthlyEssentialsCents: number, months: TargetMonths): number {
  return monthlyEssentialsCents * months;
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
