import { localDayKey } from '../domain/days';
import {
  addNewEvents,
  bakeEvents,
  fundDayEvents,
  masteryEvents,
  pointEvent,
  videoKey,
  type PointEvent,
} from '../domain/points';
import type { LoafId } from '../domain/types';
import { nowFromData } from '../money/clock';
import { endOfDayBalances } from '../money/ledger';
import type { DataAdapter } from './adapter';
import type { AppData } from './types';

/** The one emergency fund loaf. Fund-day points only ever count this loaf, so one account earns them once a day. */
const FUND_LOAF: LoafId = 'emergency-fund';

let queue: Promise<unknown> = Promise.resolve();

/**
 * Points code loads, changes and saves the whole data, like the rest of `src/data/`. Running those one after
 * another keeps two awards that start together (a video finishing while Home syncs) from overwriting each other.
 */
export function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

/** Adds events to the ledger in `data`. Returns the ones that were new. Nothing already there is touched. */
export function addToLedger(data: AppData, events: readonly PointEvent[]): PointEvent[] {
  const { ledger, added } = addNewEvents(data.points, events);
  if (added.length) data.points = ledger;
  return added;
}

/**
 * Awards every point that can be worked out from saved data, and back-fills the ones the student didn't open the
 * app for: a point for each finished day the emergency fund held steady, 5 for each mastered loaf and 10 for each
 * bake that was earned. Safe to call as often as needed, because a key already in the ledger is never added twice.
 * `changed` says whether anything was written, so a screen knows when to reload.
 */
export function syncPoints(adapter: DataAdapter): Promise<{ added: PointEvent[]; changed: boolean }> {
  return serialized(async () => {
    const data = await adapter.load();
    const today = localDayKey(nowFromData(data));
    const loafIds = [...new Set(data.quizAttempts.map((a) => a.loafId))];
    const added = addToLedger(data, [
      ...fundDayEvents(endOfDayBalances(data, FUND_LOAF, today)),
      ...masteryEvents(data.quizAttempts, loafIds),
      ...bakeEvents(data.loaves),
    ]);
    if (added.length === 0) return { added, changed: false };
    await adapter.save(data);
    return { added, changed: true };
  });
}

/**
 * A lesson's video point: given once, when the seconds actually played reach 90% of the video.
 * "Mark as watched" never calls this.
 */
export function awardVideoPoint(adapter: DataAdapter, lessonId: string): Promise<boolean> {
  return serialized(async () => {
    const data = await adapter.load();
    const at = nowFromData(data).toISOString();
    const added = addToLedger(data, [pointEvent('video', videoKey(lessonId), lessonId, at)]);
    if (added.length === 0) return false;
    await adapter.save(data);
    return true;
  });
}
