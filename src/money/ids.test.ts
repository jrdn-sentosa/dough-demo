import { describe, expect, it } from 'vitest';
import { gradeQuiz } from '../domain/quiz';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { recordQuizAttempt } from '../data/progress';
import { emptyData } from '../data/types';
import { addStarting, deposit, startLoaf, withdraw } from './ledger';

const EF = 'emergency-fund';

/** Two devices that load the same saved data and each add rows must never produce the same id. */
describe('new row ids', () => {
  it('never collide between two adapters that start from the same data', async () => {
    const seed = createMemoryAdapter();
    await startLoaf(seed, EF, 40_000);
    await addStarting(seed, EF, 5_000);
    const start = await seed.load();

    const a = createMemoryAdapter(start);
    const b = createMemoryAdapter(start);
    await deposit(a, EF, 1_000);
    await deposit(b, EF, 2_000);
    await withdraw(b, EF, 500);

    const idsA = (await a.load()).transactions.map((t) => t.id);
    const idsB = (await b.load()).transactions.map((t) => t.id);
    const newA = idsA.filter((id) => !start.transactions.some((t) => t.id === id));
    const newB = idsB.filter((id) => !start.transactions.some((t) => t.id === id));
    expect(newA).toHaveLength(1);
    expect(newB).toHaveLength(2);
    expect(new Set([...newA, ...newB]).size).toBe(3);
  });

  it('are UUIDs, and older ids keep working next to them', async () => {
    const old = emptyData();
    old.loaves.push({ loafId: EF, targetCents: 40_000, startedAt: '2026-01-01T00:00:00.000Z', bread: 'sandwich', bakes: [], growFromCents: null });
    old.transactions.push({ id: 'tx-1', loafId: EF, type: 'starting', source: 'manual', amountCents: 5_000, at: '2026-01-01T00:00:00.000Z' });
    const adapter = createMemoryAdapter(old);
    await deposit(adapter, EF, 1_000);
    const ids = (await adapter.load()).transactions.map((t) => t.id);
    expect(ids[0]).toBe('tx-1');
    expect(ids[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('never collide for quiz attempts made on two adapters from the same data', async () => {
    const questions = [{ id: 'q1', answer: 'right', explain: 'e', lesson: 'l1', timestamp: 1 }];
    const answers = { q1: 'right' };
    const start = emptyData();
    const a = createMemoryAdapter(start);
    const b = createMemoryAdapter(start);
    const first = await recordQuizAttempt(a, EF, 'lesson', gradeQuiz(questions, answers), answers);
    const second = await recordQuizAttempt(b, EF, 'lesson', gradeQuiz(questions, answers), answers);
    expect(first.id).not.toBe(second.id);
  });
});
