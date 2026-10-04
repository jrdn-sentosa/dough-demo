import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { createFirstLoaf } from './newLoaf';
import { centsToInput, parseDollarsToCents } from './parse';

describe('parseDollarsToCents', () => {
  it('reads plain dollar amounts', () => {
    expect(parseDollarsToCents('25')).toBe(2500);
    expect(parseDollarsToCents(' $1,200 ')).toBe(120000);
    expect(parseDollarsToCents('12.5')).toBe(1250);
    expect(parseDollarsToCents('12.50')).toBe(1250);
  });

  it('rejects anything else, including half-cents', () => {
    for (const bad of ['', 'abc', '-5', '12.505', '1.2.3', '$']) expect(parseDollarsToCents(bad)).toBeNull();
  });

  it('round-trips with centsToInput', () => {
    expect(centsToInput(25000)).toBe('250');
    expect(centsToInput(1250)).toBe('12.50');
  });
});

describe('createFirstLoaf', () => {
  it('starts a loaf with no savings', async () => {
    const adapter = createMemoryAdapter();
    const r = await createFirstLoaf(adapter, 'emergency-fund', 50000, null);
    expect(r.ok && r.status.balanceCents).toBe(0);
    expect((await adapter.load()).transactions).toHaveLength(0);
  });

  it('records existing savings as the first row', async () => {
    const adapter = createMemoryAdapter();
    const r = await createFirstLoaf(adapter, 'emergency-fund', 50000, 10000);
    expect(r.ok && r.status.balanceCents).toBe(10000);
    expect((await adapter.load()).transactions.map((t) => t.type)).toEqual(['starting']);
  });

  it('counts as baked at the start when savings cover the goal', async () => {
    const adapter = createMemoryAdapter();
    const r = await createFirstLoaf(adapter, 'emergency-fund', 50000, 50000);
    expect(r.ok && r.status.bakedAtStart).toBe(true);
  });

  it('asks for confirmation over $10,000 and writes nothing until confirmed', async () => {
    const adapter = createMemoryAdapter();
    const ask = await createFirstLoaf(adapter, 'emergency-fund', 2_000_000, 1_200_000);
    expect(ask).toMatchObject({ ok: false, needsConfirmation: true, message: 'Is $12,000 right?' });
    const after = await adapter.load();
    expect(after.loaves).toHaveLength(0);
    expect(after.transactions).toHaveLength(0);

    const done = await createFirstLoaf(adapter, 'emergency-fund', 2_000_000, 1_200_000, { confirmed: true });
    expect(done.ok && done.status.balanceCents).toBe(1_200_000);
  });

  it('rejects savings over $100,000 and leaves no loaf behind', async () => {
    const adapter = createMemoryAdapter();
    const r = await createFirstLoaf(adapter, 'emergency-fund', 2_000_000, 10_000_100, { confirmed: true });
    expect(r).toMatchObject({ ok: false, code: 'too-large' });
    expect((await adapter.load()).loaves).toHaveLength(0);
  });
});
