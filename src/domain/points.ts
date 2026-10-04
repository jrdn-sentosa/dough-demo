import { endOfDayIso } from './days';
import { isMastered, type ScoredAttempt } from './mastery';
import type { LoafId } from './types';

/**
 * Dough points. They sit in an append-only ledger: every award has a unique `key`, so it can never be given
 * twice, and a point is never taken back. Points are trust-based until a bank link verifies balances, so they
 * have no cash, prize or discount value anywhere in the app.
 */
export type PointKind = 'fund-day' | 'video' | 'mastery' | 'bake' | 'quiz';

export interface PointEvent {
  /** Unique per award, for example `fund-day:2026-10-05`. */
  key: string;
  kind: PointKind;
  /** Always a positive whole number. */
  points: number;
  /** ISO string in UTC. For a whole-day award this is the end of that day. */
  at: string;
  /** What earned it: a day, a lesson id or a loaf id. History turns this into words from content. */
  ref: string;
}

export const POINT_KINDS: readonly PointKind[] = ['fund-day', 'video', 'mastery', 'bake', 'quiz'];

export const POINT_VALUES: Record<PointKind, number> = {
  'fund-day': 1,
  video: 1,
  mastery: 5,
  bake: 10,
  quiz: 1,
};

export const fundDayKey = (day: string) => `fund-day:${day}`;
export const videoKey = (lessonId: string) => `video:${lessonId}`;
export const masteryKey = (loafId: LoafId) => `mastery:${loafId}`;
export const bakeKey = (loafId: LoafId, targetCents: number) => `bake:${loafId}:${targetCents}`;
export const quizKey = (day: string) => `quiz:${day}`;

export function pointEvent(kind: PointKind, key: string, ref: string, at: string): PointEvent {
  return { key, kind, points: POINT_VALUES[kind], at, ref };
}

/** The fund's balance at the end of one local day. */
export interface DayBalance {
  day: string;
  endCents: number;
}

/**
 * The days that earn a "fund holds steady" point: the balance at the end of the day is above zero and not lower
 * than at the end of the day before (zero before the first day). `series` must have one entry per day, in order.
 */
export function fundHoldDays(series: readonly DayBalance[]): string[] {
  const days: string[] = [];
  let previous = 0;
  for (const { day, endCents } of series) {
    if (endCents > 0 && endCents >= previous) days.push(day);
    previous = endCents;
  }
  return days;
}

export function fundDayEvents(series: readonly DayBalance[]): PointEvent[] {
  return fundHoldDays(series).map((day) => pointEvent('fund-day', fundDayKey(day), day, endOfDayIso(day)));
}

/** One mastery award per loaf, dated by the first normal-quiz attempt that reached mastery. */
export function masteryEvents(
  attempts: readonly (ScoredAttempt & { at: string })[],
  loafIds: readonly LoafId[],
): PointEvent[] {
  const events: PointEvent[] = [];
  for (const loafId of loafIds) {
    if (!isMastered(attempts, loafId)) continue;
    const ordered = attempts
      .filter((a) => a.loafId === loafId && a.mode === 'lesson')
      .sort((a, b) => a.at.localeCompare(b.at));
    // The first attempt after which the best score was already at the mastery line.
    const first = ordered.find((_, i) => isMastered(ordered.slice(0, i + 1), loafId));
    if (first) events.push(pointEvent('mastery', masteryKey(loafId), loafId, first.at));
  }
  return events;
}

/** One bake award per bake that was earned (not "Already built"), keyed by its target. */
export function bakeEvents(
  loaves: readonly { loafId: LoafId; bakes: readonly { targetCents: number; at: string | null }[] }[],
): PointEvent[] {
  const events: PointEvent[] = [];
  for (const loaf of loaves) {
    for (const bake of loaf.bakes) {
      if (bake.at === null) continue;
      events.push(pointEvent('bake', bakeKey(loaf.loafId, bake.targetCents), loaf.loafId, bake.at));
    }
  }
  return events;
}

/**
 * Adds the events whose key isn't in the ledger yet. Returns the new ledger (oldest first) and what was added.
 * Existing rows are never changed or removed.
 */
export function addNewEvents(
  ledger: readonly PointEvent[],
  incoming: readonly PointEvent[],
): { ledger: PointEvent[]; added: PointEvent[] } {
  const known = new Set(ledger.map((e) => e.key));
  const added: PointEvent[] = [];
  for (const event of incoming) {
    if (known.has(event.key)) continue;
    known.add(event.key);
    added.push(event);
  }
  return { ledger: [...ledger, ...added].sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key)), added };
}

export function pointsTotal(ledger: readonly PointEvent[]): number {
  return ledger.reduce((sum, e) => sum + e.points, 0);
}

/** The ledger newest first, for the history screen. */
export function historyNewestFirst(ledger: readonly PointEvent[]): PointEvent[] {
  return [...ledger].sort((a, b) => b.at.localeCompare(a.at) || b.key.localeCompare(a.key));
}
