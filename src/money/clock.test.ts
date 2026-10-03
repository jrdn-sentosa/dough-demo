import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { advance, now, nowIso, reset } from './clock';

const REAL = Date.UTC(2026, 0, 10, 12, 0, 0);
const real = () => REAL;

describe('demo clock', () => {
  it('matches real time until advanced', async () => {
    expect((await now(createMemoryAdapter(), real)).getTime()).toBe(REAL);
  });

  it('advances by whole days and persists with the data', async () => {
    const adapter = createMemoryAdapter();
    await advance(adapter, 7);
    await advance(adapter, 7);
    expect(await nowIso(adapter, real)).toBe('2026-01-24T12:00:00.000Z');
    expect((await adapter.load()).clock.offsetDays).toBe(14);
  });

  it('reset returns to real time', async () => {
    const adapter = createMemoryAdapter();
    await advance(adapter, 7);
    await reset(adapter);
    expect((await now(adapter, real)).getTime()).toBe(REAL);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects advancing by %s days', async (days) => {
    await expect(advance(createMemoryAdapter(), days)).rejects.toThrow(RangeError);
  });
});
