import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { advance } from './clock';
import {
  addStarting,
  balanceCents,
  deposit,
  getLoafStatus,
  listTransactions,
  setTarget,
  type MoneyFailure,
  startLoaf,
  withdraw,
} from './ledger';
import { REBUILD_MESSAGE, STARTING_LABEL } from './messages';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

async function startEf(targetDollars = 400) {
  const r = await startLoaf(adapter, EF, dollars(targetDollars));
  if (!r.ok) throw new Error(r.message);
}

/** Unwraps a successful result, failing the test with the message otherwise. */
async function ok<T extends { ok: boolean }>(promise: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const r = await promise;
  if (!r.ok) throw new Error((r as unknown as MoneyFailure).message);
  return r as Extract<T, { ok: true }>;
}

beforeEach(() => {
  adapter = createMemoryAdapter();
});

describe('balances come from rows', () => {
  it('adds starting and deposits and subtracts withdrawals', async () => {
    await startEf();
    await ok(addStarting(adapter, EF, dollars(100)));
    await ok(deposit(adapter, EF, dollars(50)));
    await ok(withdraw(adapter, EF, dollars(30)));
    expect(balanceCents(await adapter.load(), EF)).toBe(dollars(120));
    expect((await getLoafStatus(adapter, EF))?.percent).toBe(30);
  });

  it('keeps loaves separate, so the next loaf starts at zero', async () => {
    await startEf(100);
    await ok(deposit(adapter, EF, dollars(150)));
    await ok(startLoaf(adapter, 'roth-ira', dollars(500)));
    expect((await getLoafStatus(adapter, 'roth-ira'))?.balanceCents).toBe(0);
  });

  it('dates every row from the demo clock', async () => {
    await startEf();
    const first = await ok(deposit(adapter, EF, dollars(5)));
    await advance(adapter, 7);
    const second = await ok(deposit(adapter, EF, dollars(5)));
    const gap = Date.parse(second.transaction.at) - Date.parse(first.transaction.at);
    expect(Math.round(gap / 86_400_000)).toBe(7);
  });
});

describe('amount rules', () => {
  beforeEach(() => startEf());

  it.each([0, -500, 12.5, Number.NaN])('rejects %s', async (amount) => {
    expect((await deposit(adapter, EF, amount)).ok).toBe(false);
    expect((await withdraw(adapter, EF, amount)).ok).toBe(false);
    expect((await adapter.load()).transactions).toHaveLength(0);
  });

  it('allows exactly $10,000 and rejects more with a friendly message', async () => {
    expect((await deposit(adapter, EF, dollars(10_000))).ok).toBe(true);
    const over = await deposit(adapter, EF, dollars(10_000) + 1);
    expect(over).toMatchObject({ ok: false, code: 'too-large' });
    if (!over.ok) expect(over.message).toContain('$10,000');
    expect(await withdraw(adapter, EF, dollars(10_000) + 1)).toMatchObject({ ok: false, code: 'too-large' });
  });
});

describe('starting savings', () => {
  beforeEach(() => startEf());

  it('is stored as a "starting" transaction', async () => {
    await ok(addStarting(adapter, EF, dollars(100)));
    const rows = await listTransactions(adapter, EF);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('starting');
    expect(STARTING_LABEL).toBe('Savings you already had');
  });

  it('goes straight in up to $10,000 with no confirmation', async () => {
    expect((await addStarting(adapter, EF, dollars(10_000))).ok).toBe(true);
  });

  it('asks for confirmation above $10,000, writes nothing, then accepts when confirmed', async () => {
    const ask = await addStarting(adapter, EF, dollars(25_000));
    expect(ask).toMatchObject({ ok: false, code: 'needs-confirmation', needsConfirmation: true });
    expect((await adapter.load()).transactions).toHaveLength(0);

    const confirmed = await addStarting(adapter, EF, dollars(25_000), { confirmed: true });
    expect(confirmed.ok).toBe(true);
    expect(balanceCents(await adapter.load(), EF)).toBe(dollars(25_000));
  });

  it('allows exactly $100,000 once confirmed', async () => {
    expect((await addStarting(adapter, EF, dollars(100_000), { confirmed: true })).ok).toBe(true);
  });

  it('rejects over $100,000 outright, not as a confirmation', async () => {
    const r = await addStarting(adapter, EF, dollars(100_000) + 1, { confirmed: true });
    expect(r).toMatchObject({ ok: false, code: 'too-large' });
    expect('needsConfirmation' in r).toBe(false);
  });

  it('can only be the first row of a loaf', async () => {
    await ok(deposit(adapter, EF, dollars(5)));
    expect(await addStarting(adapter, EF, dollars(100))).toMatchObject({ ok: false, code: 'starting-too-late' });
  });

  it('marks the loaf baked at start when it meets the target, with no completion date', async () => {
    const r = await ok(addStarting(adapter, EF, dollars(400)));
    expect(r.status).toMatchObject({ baked: true, bakedAtStart: true, firstBakedAt: null, rebuilding: false });
  });

  it('is no longer baked at start after the target is raised above the balance', async () => {
    await ok(addStarting(adapter, EF, dollars(400)));
    const r = await ok(setTarget(adapter, EF, dollars(1200)));
    expect(r.status).toMatchObject({ baked: false, bakedAtStart: false, percent: 33 });
  });
});

describe('withdrawals', () => {
  beforeEach(() => startEf());

  it('cannot exceed the balance, and says what is available', async () => {
    await ok(deposit(adapter, EF, dollars(40)));
    const r = await withdraw(adapter, EF, dollars(50));
    expect(r).toMatchObject({ ok: false, code: 'insufficient', availableCents: dollars(40) });
    if (!r.ok) expect(r.message).toContain('$40');
    expect(balanceCents(await adapter.load(), EF)).toBe(dollars(40));
  });

  it('allows taking the whole balance', async () => {
    await ok(deposit(adapter, EF, dollars(40)));
    const r = await ok(withdraw(adapter, EF, dollars(40)));
    expect(r.status.balanceCents).toBe(0);
  });

  it('shrinks the loaf to the stage for the new balance with the supportive message', async () => {
    await ok(deposit(adapter, EF, dollars(300)));
    const r = await ok(withdraw(adapter, EF, dollars(200)));
    expect(r.status.stage).toBe('shape');
    expect(r.message).toBe(REBUILD_MESSAGE);
  });
});

describe('reaching the target', () => {
  beforeEach(() => startEf(100));

  it('returns baked: true when a deposit reaches 100% and records the first bake', async () => {
    const mid = await ok(deposit(adapter, EF, dollars(60)));
    expect(mid.baked).toBe(false);
    const done = await ok(deposit(adapter, EF, dollars(40)));
    expect(done).toMatchObject({ baked: true, rebuilt: false });
    expect(done.status.firstBakedAt).toBe(done.transaction.at);
    expect(done.status.stage).toBe('baked');
  });

  it('keeps extra money above the target, with progress clamped at 100%', async () => {
    const r = await ok(deposit(adapter, EF, dollars(130)));
    expect(r.baked).toBe(true);
    expect(r.status).toMatchObject({ balanceCents: dollars(130), percent: 100 });
  });

  it('does not celebrate again for more money after the target', async () => {
    await ok(deposit(adapter, EF, dollars(100)));
    const extra = await ok(deposit(adapter, EF, dollars(20)));
    expect(extra.baked).toBe(false);
  });
});

describe('withdrawing after baked', () => {
  beforeEach(() => startEf(100));

  it('puts the fund in rebuild mode at the matching stage and keeps the first bake', async () => {
    const baked = await ok(deposit(adapter, EF, dollars(100)));
    const r = await ok(withdraw(adapter, EF, dollars(60)));
    expect(r.status).toMatchObject({ rebuilding: true, stage: 'shape', percent: 40 });
    expect(r.status.firstBakedAt).toBe(baked.status.firstBakedAt);
    expect(r.message).toBe(REBUILD_MESSAGE);
  });

  it('stays baked, not rebuilding, when overflow covers the withdrawal', async () => {
    await ok(deposit(adapter, EF, dollars(130)));
    const r = await ok(withdraw(adapter, EF, dollars(20)));
    expect(r.status).toMatchObject({ rebuilding: false, stage: 'baked' });
  });

  it('flags rebuilt: true on the bake that finishes a rebuild, keeping the first bake', async () => {
    const first = await ok(deposit(adapter, EF, dollars(100)));
    await advance(adapter, 14);
    await ok(withdraw(adapter, EF, dollars(60)));
    const again = await ok(deposit(adapter, EF, dollars(60)));
    expect(again).toMatchObject({ baked: true, rebuilt: true });
    expect(again.status.firstBakedAt).toBe(first.status.firstBakedAt);
  });

  it('rebuilds a fund that was baked at start, still with no completion date', async () => {
    await ok(addStarting(adapter, EF, dollars(100)));
    const w = await ok(withdraw(adapter, EF, dollars(50)));
    expect(w.status).toMatchObject({ rebuilding: true, firstBakedAt: null, bakedAtStart: true });
    const again = await ok(deposit(adapter, EF, dollars(50)));
    expect(again).toMatchObject({ baked: true, rebuilt: true });
    expect(again.status.firstBakedAt).toBeNull();
  });
});

describe('loaf lookups', () => {
  it('fails politely for a loaf that was never started', async () => {
    expect(await deposit(adapter, EF, 500)).toMatchObject({ ok: false, code: 'no-loaf' });
    expect(await getLoafStatus(adapter, EF)).toBeNull();
  });

  it('does not start the same loaf twice', async () => {
    await startEf();
    expect(await startLoaf(adapter, EF, 1000)).toMatchObject({ ok: false, code: 'loaf-exists' });
  });
});
