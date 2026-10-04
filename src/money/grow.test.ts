import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { advance } from './clock';
import {
  addStarting,
  deposit,
  getLoafStatus,
  setTarget,
  startLoaf,
  withdraw,
  type MoneyFailure,
} from './ledger';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

/** Unwraps a successful result, failing the test with the message otherwise. */
async function ok<T extends { ok: boolean }>(promise: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const r = await promise;
  if (!r.ok) throw new Error((r as unknown as MoneyFailure).message);
  return r as Extract<T, { ok: true }>;
}

async function startEf(targetDollars: number) {
  await ok(startLoaf(adapter, EF, dollars(targetDollars)));
}

beforeEach(() => {
  adapter = createMemoryAdapter();
});

describe('the shelf keeps every bake', () => {
  beforeEach(() => startEf(100));

  it('records the target and date of the first bake', async () => {
    const r = await ok(deposit(adapter, EF, dollars(100)));
    expect(r.status.bakes).toEqual([{ targetCents: dollars(100), at: r.transaction.at, bread: 'sandwich' }]);
  });

  it('records an "Already built" bake with no date', async () => {
    const r = await ok(addStarting(adapter, EF, dollars(100)));
    expect(r.status.bakes).toEqual([{ targetCents: dollars(100), at: null, bread: 'sandwich' }]);
  });

  it('starts with no bakes', async () => {
    expect((await getLoafStatus(adapter, EF))?.bakes).toEqual([]);
  });

  it('adds nothing for extra money, withdrawals, or finishing a rebuild', async () => {
    await ok(deposit(adapter, EF, dollars(100)));
    await ok(deposit(adapter, EF, dollars(20)));
    await ok(withdraw(adapter, EF, dollars(80)));
    const again = await ok(deposit(adapter, EF, dollars(60)));
    expect(again).toMatchObject({ baked: true, rebuilt: true, grown: false });
    expect(again.status.bakes).toHaveLength(1);
  });

  it('adds a second entry when a grown fund reaches the bigger target, keeping the first', async () => {
    const first = await ok(deposit(adapter, EF, dollars(100)));
    await ok(setTarget(adapter, EF, dollars(300), { grow: true }));
    await advance(adapter, 30);
    const second = await ok(deposit(adapter, EF, dollars(200)));
    expect(second).toMatchObject({ baked: true, grown: true, rebuilt: false });
    expect(second.status.bakes).toEqual([
      { targetCents: dollars(100), at: first.transaction.at, bread: 'sandwich' },
      { targetCents: dollars(300), at: second.transaction.at, bread: 'sandwich' },
    ]);
    expect(second.status.firstBakedAt).toBe(first.transaction.at);
  });

  it('keeps an "Already built" first entry next to the grown one', async () => {
    await ok(addStarting(adapter, EF, dollars(100)));
    await ok(setTarget(adapter, EF, dollars(300), { grow: true }));
    const r = await ok(deposit(adapter, EF, dollars(200)));
    expect(r.status.bakes).toEqual([
      { targetCents: dollars(100), at: null, bread: 'sandwich' },
      { targetCents: dollars(300), at: r.transaction.at, bread: 'sandwich' },
    ]);
    expect(r.status.bakedAtStart).toBe(true);
  });

  it('adds no bake for a rebuild after a grown fund is withdrawn from', async () => {
    await ok(deposit(adapter, EF, dollars(100)));
    await ok(setTarget(adapter, EF, dollars(300), { grow: true }));
    await ok(deposit(adapter, EF, dollars(200)));
    await ok(withdraw(adapter, EF, dollars(100)));
    const again = await ok(deposit(adapter, EF, dollars(100)));
    expect(again).toMatchObject({ baked: true, rebuilt: true, grown: false });
    expect(again.status.bakes).toHaveLength(2);
  });

  it('still adds the bigger bake when a withdrawal cancelled growing before the fund reached it', async () => {
    await ok(deposit(adapter, EF, dollars(100)));
    await ok(setTarget(adapter, EF, dollars(300), { grow: true }));
    await ok(deposit(adapter, EF, dollars(50)));
    await ok(withdraw(adapter, EF, dollars(10)));
    const r = await ok(deposit(adapter, EF, dollars(160)));
    expect(r).toMatchObject({ baked: true, grown: true, rebuilt: false });
    expect(r.status.bakes.map((b) => b.targetCents)).toEqual([dollars(100), dollars(300)]);
  });
});

describe('growing a baked fund', () => {
  beforeEach(async () => {
    await startEf(400);
    await ok(deposit(adapter, EF, dollars(400)));
  });

  it('starts the growth as a dough ball, not a shrunken loaf, and keeps the whole fund total', async () => {
    const r = await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    expect(r).toMatchObject({ baked: false, grown: false, rebuilt: false });
    expect(r.status).toMatchObject({
      growing: true,
      growFromCents: dollars(400),
      rebuilding: false,
      percent: 0,
      stage: 'mix',
      balanceCents: dollars(400),
      targetCents: dollars(1200),
    });
  });

  it('counts progress on the new part only', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    const r = await ok(deposit(adapter, EF, dollars(200)));
    expect(r.status).toMatchObject({ percent: 25, stage: 'shape', balanceCents: dollars(600), growing: true });
    const next = await ok(deposit(adapter, EF, dollars(400)));
    expect(next.status).toMatchObject({ percent: 75, stage: 'bake' });
    expect(next.baked).toBe(false);
  });

  it('bakes with grown: true at the new target and ends growing', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    const r = await ok(deposit(adapter, EF, dollars(800)));
    expect(r).toMatchObject({ baked: true, grown: true, rebuilt: false });
    expect(r.status).toMatchObject({ growing: false, growFromCents: null, percent: 100, stage: 'baked' });
  });

  it('goes back to balance / target after a withdrawal clears growing', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    await ok(deposit(adapter, EF, dollars(200)));
    const r = await ok(withdraw(adapter, EF, dollars(100)));
    expect(r.status).toMatchObject({
      growing: false,
      growFromCents: null,
      rebuilding: true,
      balanceCents: dollars(500),
      percent: 41,
      stage: 'shape',
    });
  });

  it('bakes at once when the balance already covers the bigger target', async () => {
    await ok(deposit(adapter, EF, dollars(200)));
    const r = await ok(setTarget(adapter, EF, dollars(500), { grow: true }));
    expect(r).toMatchObject({ baked: true, grown: true, status: { growing: false, percent: 100 } });
    expect(r.status.bakes.map((b) => b.targetCents)).toEqual([dollars(400), dollars(500)]);
  });

  it('keeps the first growFromCents when the goal is raised again while growing', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    const r = await ok(setTarget(adapter, EF, dollars(2400), { grow: true }));
    expect(r.status).toMatchObject({ growing: true, growFromCents: dollars(400), targetCents: dollars(2400) });
  });

  it('is stored on the loaf, so it survives a reload', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    expect(await getLoafStatus(adapter, EF)).toMatchObject({ growing: true, growFromCents: dollars(400) });
  });

  it('is refused unless the target is bigger, and leaves the loaf unchanged', async () => {
    expect(await setTarget(adapter, EF, dollars(400), { grow: true })).toMatchObject({
      ok: false,
      code: 'grow-not-bigger',
    });
    expect(await setTarget(adapter, EF, dollars(300), { grow: true })).toMatchObject({ ok: false });
    expect(await getLoafStatus(adapter, EF)).toMatchObject({ growing: false, targetCents: dollars(400) });
  });

  it('is refused while rebuilding', async () => {
    await ok(withdraw(adapter, EF, dollars(100)));
    expect(await setTarget(adapter, EF, dollars(1200), { grow: true })).toMatchObject({
      ok: false,
      code: 'grow-not-ready',
    });
  });

  it('raising the target without grow just edits the goal and does not start growing', async () => {
    const r = await ok(setTarget(adapter, EF, dollars(1200)));
    expect(r.status).toMatchObject({ growing: false, rebuilding: true, percent: 33 });
  });

  it('drops growing when the target is lowered back to the old target', async () => {
    await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    const r = await ok(setTarget(adapter, EF, dollars(400)));
    expect(r).toMatchObject({ baked: false, status: { growing: false, percent: 100, stage: 'baked' } });
    expect(r.status.bakes).toHaveLength(1);
  });
});

describe('growing needs a baked fund', () => {
  it('is refused for a fund that has not baked', async () => {
    await startEf(400);
    await ok(deposit(adapter, EF, dollars(100)));
    expect(await setTarget(adapter, EF, dollars(1200), { grow: true })).toMatchObject({
      ok: false,
      code: 'grow-not-ready',
    });
  });

  it('works for a fund that was "Already built", and keeps that shelf entry', async () => {
    await startEf(400);
    await ok(addStarting(adapter, EF, dollars(400)));
    const r = await ok(setTarget(adapter, EF, dollars(1200), { grow: true }));
    expect(r.status).toMatchObject({ growing: true, growFromCents: dollars(400), percent: 0 });
    expect(r.status.bakes).toEqual([{ targetCents: dollars(400), at: null, bread: 'sandwich' }]);
  });
});
