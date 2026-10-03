import type { EssentialsBand, SavingsBand } from './types';

/** Monthly essentials. Content refers to these by id. */
export const ESSENTIALS_BANDS: readonly EssentialsBand[] = [
  { id: 'under-250', kind: 'range', minCents: 0, maxCents: 24_999 },
  { id: '250-499', kind: 'range', minCents: 25_000, maxCents: 49_999 },
  { id: '500-749', kind: 'range', minCents: 50_000, maxCents: 74_999 },
  { id: '750-999', kind: 'range', minCents: 75_000, maxCents: 99_999 },
  { id: '1000-1499', kind: 'range', minCents: 100_000, maxCents: 149_999 },
  { id: '1500-plus', kind: 'open', minCents: 150_000, maxCents: null },
  // Starter target of $500, shown as an estimate the student can change.
  { id: 'not-sure', kind: 'unsure', minCents: 50_000, maxCents: 50_000 },
];

/** Existing emergency savings. Credited at the lower bound. */
export const SAVINGS_BANDS: readonly SavingsBand[] = [
  { id: 'none', minCents: 0, maxCents: 0 },
  { id: '1-99', minCents: 100, maxCents: 9_999 },
  { id: '100-249', minCents: 10_000, maxCents: 24_999 },
  { id: '250-499', minCents: 25_000, maxCents: 49_999 },
  { id: '500-999', minCents: 50_000, maxCents: 99_999 },
  { id: '1000-plus', minCents: 100_000, maxCents: null },
];

export function essentialsBand(id: string): EssentialsBand {
  const band = ESSENTIALS_BANDS.find((b) => b.id === id);
  if (!band) throw new Error(`Unknown essentials band: ${id}`);
  return band;
}

export function savingsBand(id: string): SavingsBand {
  const band = SAVINGS_BANDS.find((b) => b.id === id);
  if (!band) throw new Error(`Unknown savings band: ${id}`);
  return band;
}
