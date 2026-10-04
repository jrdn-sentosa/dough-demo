import type { DataAdapter } from '../data/adapter';
import type { AppData } from '../data/types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The demo clock. This is the only file that reads the real time. Everything
 * else (transaction dates, domain code) gets "now" from here.
 *
 * The clock is stored as whole days moved forward from real time, saved with
 * the rest of the data so it survives a page reload.
 */
export async function now(adapter: DataAdapter, realNowMs: () => number = Date.now): Promise<Date> {
  const { clock } = await adapter.load();
  return new Date(realNowMs() + clock.offsetDays * DAY_MS);
}

export async function nowIso(adapter: DataAdapter, realNowMs?: () => number): Promise<string> {
  return (await now(adapter, realNowMs)).toISOString();
}

/** The same time as `now`, for screens that already hold the loaded data and can't wait on the adapter. */
export function nowFromData(data: Pick<AppData, 'clock'>, realNowMs: () => number = Date.now): Date {
  return new Date(realNowMs() + data.clock.offsetDays * DAY_MS);
}

/** Moves the demo clock forward by a positive whole number of days. */
export async function advance(adapter: DataAdapter, days: number): Promise<void> {
  if (!Number.isInteger(days) || days <= 0) {
    throw new RangeError('advance(days) needs a positive whole number of days');
  }
  const data = await adapter.load();
  data.clock.offsetDays += days;
  await adapter.save(data);
}

export async function reset(adapter: DataAdapter): Promise<void> {
  const data = await adapter.load();
  data.clock.offsetDays = 0;
  await adapter.save(data);
}

/** Real time with no demo offset. Used only to date a fresh demo seed. */
export function realNow(realNowMs: () => number = Date.now): Date {
  return new Date(realNowMs());
}
