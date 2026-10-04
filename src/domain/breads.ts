/**
 * Breads are a look, never a different loaf rule: goals, stages and baking work the same.
 * Each topic keeps its own bread as the default (the emergency fund's is the sandwich loaf),
 * and the rest are unlocked by saving streaks.
 */
export const DEFAULT_BREAD = 'sandwich';

/** The breads a saving streak can unlock, in ladder order. */
export const UNLOCKABLE_BREADS = ['baguette', 'bagel', 'focaccia', 'pretzel', 'brioche', 'croissant'] as const;
export type UnlockableBread = (typeof UNLOCKABLE_BREADS)[number];

export const BREAD_IDS = [DEFAULT_BREAD, ...UNLOCKABLE_BREADS] as const;
export type BreadId = (typeof BREAD_IDS)[number];

/**
 * The ladder: weeks of consistent saving each bread needs. Measured in weeks, not periods,
 * so a student paid every two weeks or monthly climbs it the same way as a weekly saver.
 */
export const LADDER: readonly { bread: UnlockableBread; weeks: number }[] = [
  { bread: 'baguette', weeks: 2 },
  { bread: 'bagel', weeks: 4 },
  { bread: 'focaccia', weeks: 6 },
  { bread: 'pretzel', weeks: 8 },
  { bread: 'brioche', weeks: 12 },
  { bread: 'croissant', weeks: 16 },
];

export function isBreadId(value: unknown): value is BreadId {
  return typeof value === 'string' && (BREAD_IDS as readonly string[]).includes(value);
}

export function weeksFor(bread: UnlockableBread): number {
  return (LADDER.find((rung) => rung.bread === bread) as { weeks: number }).weeks;
}

/** The breads the student can pick for a loaf: the default plus everything unlocked, in ladder order. */
export function availableBreads(unlocked: readonly BreadId[]): BreadId[] {
  return [DEFAULT_BREAD, ...UNLOCKABLE_BREADS.filter((b) => unlocked.includes(b))];
}
