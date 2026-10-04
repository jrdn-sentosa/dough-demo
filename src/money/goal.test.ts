import { beforeEach, describe, expect, it } from 'vitest';
import type { DataAdapter } from '../data/adapter';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { changeGoal, deposit, startLoaf, withdraw, type MoneyFailure } from './ledger';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

async function ok<T extends { ok: boolean }>(promise: Promise<T>): Promise<Extract<T, { ok: true }>> {
  const r = await promise;
  if (!r.ok) throw new Error((r as unknown as MoneyFailure).message);
  return r as Extract<T, { ok: true }>;
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await ok(startLoaf(adapter, EF, dollars(400)));
});

describe('changeGoal (Settings, "Change your goal")', () => {
  it('lowering to or below the balance bakes the loaf', async () => {
    await ok(deposit(adapter, EF, dollars(150)));
    const r = await ok(changeGoal(adapter, EF, dollars(150)));
    expect(r).toMatchObject({ baked: true, status: { percent: 100, stage: 'baked' } });
  });

  it('raising it above the balance of a baked fund starts growing', async () => {
    await ok(deposit(adapter, EF, dollars(400)));
    const r = await ok(changeGoal(adapter, EF, dollars(1200)));
    expect(r.status).toMatchObject({
      growing: true,
      growFromCents: dollars(400),
      percent: 0,
      stage: 'mix',
      rebuilding: false,
    });
  });

  it('raising it again while growing keeps the growth start', async () => {
    await ok(deposit(adapter, EF, dollars(400)));
    await ok(changeGoal(adapter, EF, dollars(1200)));
    const r = await ok(changeGoal(adapter, EF, dollars(2400)));
    expect(r.status).toMatchObject({ growing: true, growFromCents: dollars(400) });
  });

  it('raising it while rebuilding just edits the goal, with no growing', async () => {
    await ok(deposit(adapter, EF, dollars(400)));
    await ok(withdraw(adapter, EF, dollars(200)));
    const r = await ok(changeGoal(adapter, EF, dollars(1200)));
    expect(r.status).toMatchObject({ growing: false, rebuilding: true, percent: 16 });
  });

  it('raising it before the fund has ever baked just edits the goal', async () => {
    await ok(deposit(adapter, EF, dollars(100)));
    const r = await ok(changeGoal(adapter, EF, dollars(800)));
    expect(r.status).toMatchObject({ growing: false, baked: false, percent: 12 });
  });

  it('raising it to a goal the balance already covers bakes at once and adds a shelf entry', async () => {
    await ok(deposit(adapter, EF, dollars(600)));
    const r = await ok(changeGoal(adapter, EF, dollars(500)));
    expect(r).toMatchObject({ baked: true, grown: true });
    expect(r.status.bakes.map((b) => b.targetCents)).toEqual([dollars(400), dollars(500)]);
  });

  it('works for a fund that was baked at the $1,000 starter goal', async () => {
    adapter = createMemoryAdapter();
    await ok(startLoaf(adapter, EF, dollars(1000)));
    await ok(deposit(adapter, EF, dollars(1000)));
    // The student answers the essentials question: 3 months of $400 is $1,200.
    const r = await ok(changeGoal(adapter, EF, dollars(1200)));
    expect(r.status).toMatchObject({ growing: true, growFromCents: dollars(1000), targetCents: dollars(1200) });
  });

  it('fails clearly when the loaf does not exist', async () => {
    adapter = createMemoryAdapter();
    expect(await changeGoal(adapter, EF, dollars(500))).toMatchObject({ ok: false, code: 'no-loaf' });
  });

  it('rejects an amount that is zero or negative', async () => {
    expect(await changeGoal(adapter, EF, 0)).toMatchObject({ ok: false, code: 'not-positive' });
  });
});
