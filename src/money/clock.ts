import type { DataAdapter } from '../data/adapter';

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
