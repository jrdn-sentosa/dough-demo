import { describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { DEMO_EMAIL } from '../data/session';
import { streakFromData, syncStreaks, unseenUnlock } from '../data/streaks';
import { guardRedirect } from '../app/guard';
import { recommendNext } from '../domain/recommendations';
import { monthsForTarget } from '../domain/targets';
import { resetDemo, signInAsMaya, skipWeek, startFreshDemo } from './demo';
import { getLoafStatus } from './ledger';
import { mayaSeed } from './seed';

const EF = 'emergency-fund';
const NOW = new Date('2026-10-04T12:00:00.000Z');

async function maya() {
  const adapter = createMemoryAdapter();
  await signInAsMaya(adapter, () => NOW.getTime());
  return adapter;
}

describe("Maya's seed", () => {
  it('has her placement answers and starts on Home', async () => {
    const data = mayaSeed(NOW);
    expect(data.user?.email).toBe(DEMO_EMAIL);
    expect(data.profile).toMatchObject({
      placementStatus: 'complete',
      savings: 'none',
      accounts: ['checking', 'regular-savings'],
      cardDebt: 'no',
      earnedIncome: true,
    });
    expect(guardRedirect('/', data)).toBeNull();
  });

  it('puts the emergency fund at $240 of $400 (60%) from six weekly seed deposits', async () => {
    const adapter = await maya();
    const status = await getLoafStatus(adapter, EF);
    expect(status).toMatchObject({ balanceCents: 24_000, targetCents: 40_000, percent: 60 });
    const { transactions } = await adapter.load();
    expect(transactions).toHaveLength(6);
    expect(transactions.every((t) => t.type === 'deposit' && t.source === 'seed')).toBe(true);
  });

  it('has watched the lessons and taken the quiz without testing out', async () => {
    const data = mayaSeed(NOW);
    expect(data.lessonProgress).toHaveLength(3);
    expect(data.quizAttempts).toHaveLength(1);
    expect(data.quizAttempts[0].mode).toBe('lesson');
  });

  it('has a 6-week streak', async () => {
    expect(streakFromData(await (await maya()).load())).toBe(6);
  });

  it('marks the breads her streak already earned as seen, so no unlock messages show on open', async () => {
    const adapter = await maya();
    const data = await adapter.load();
    expect(data.streaks.unlocked.map((u) => u.bread)).toEqual(['baguette', 'bagel', 'focaccia']);
    expect(data.streaks.unlocked.every((u) => u.seen)).toBe(true);
    expect(unseenUnlock(data)).toBeNull();
    // Home syncs streaks on load: nothing new, so nothing to show.
    expect((await syncStreaks(adapter)).fresh).toEqual([]);
    expect(unseenUnlock(await adapter.load())).toBeNull();
  });

  it('still shows her next unlock (pretzel, 8 weeks) normally', async () => {
    const adapter = await maya();
    const first = await skipWeek(adapter, EF);
    if (!first.ok) throw new Error(first.message);
    expect(first.unlocked).toEqual([]);
    const second = await skipWeek(adapter, EF);
    if (!second.ok) throw new Error(second.message);
    expect(second.unlocked).toEqual(['pretzel']);
    expect(unseenUnlock(await adapter.load())).toBe('pretzel');
  });

  it('points to Keep saving when her fund bakes (her target is under 3 months)', async () => {
    const { profile } = mayaSeed(NOW);
    const targetMonths = monthsForTarget(40_000, profile?.essentialsCents ?? 0);
    const result = recommendNext({ cardDebt: profile?.cardDebt ?? undefined, targetMonths, targetIsDefault: false });
    expect(result.path).toBe('save');
  });
});

describe('Continue as demo user', () => {
  it('keeps existing local demo data instead of reseeding', async () => {
    const adapter = await maya();
    await skipWeek(adapter, EF);
    const before = await adapter.load();
    before.user = null; // Exit demo
    await adapter.save(before);
    await signInAsMaya(adapter, () => NOW.getTime());
    const after = await adapter.load();
    expect(after.user?.email).toBe(DEMO_EMAIL);
    expect(after.transactions).toHaveLength(7);
  });
});

describe('Reset demo', () => {
  it('puts Maya back as she started, clock included', async () => {
    const adapter = await maya();
    await skipWeek(adapter, EF);
    await skipWeek(adapter, EF);
    expect(await resetDemo(adapter, () => NOW.getTime())).toEqual({ ok: true });
    const data = await adapter.load();
    expect(data.clock.offsetDays).toBe(0);
    expect(data.transactions).toHaveLength(6);
    expect((await getLoafStatus(adapter, EF))?.percent).toBe(60);
  });

  it('refuses for a real account and changes nothing', async () => {
    const adapter = createMemoryAdapter();
    const data = await adapter.load();
    data.user = { email: 'sam@school.edu' };
    await adapter.save(data);
    const result = await resetDemo(adapter);
    expect(result).toMatchObject({ ok: false, code: 'not-demo' });
    expect(await adapter.load()).toEqual(data);
  });

  it('refuses when nobody is signed in', async () => {
    expect(await resetDemo(createMemoryAdapter())).toMatchObject({ ok: false, code: 'not-demo' });
  });
});

describe('Start fresh demo', () => {
  it('clears the demo and sends a plain demo user to the placement quiz', async () => {
    const adapter = await maya();
    expect(await startFreshDemo(adapter)).toEqual({ ok: true });
    const data = await adapter.load();
    expect(data.user?.email).toBe(DEMO_EMAIL);
    expect(data.profile).toBeNull();
    expect(data.loaves).toEqual([]);
    expect(guardRedirect('/', data)).toBe('/placement');
  });

  it('refuses for a real account', async () => {
    const adapter = createMemoryAdapter();
    const data = await adapter.load();
    data.user = { email: 'sam@school.edu' };
    await adapter.save(data);
    expect(await startFreshDemo(adapter)).toMatchObject({ ok: false, code: 'not-demo' });
    expect((await adapter.load()).user?.email).toBe('sam@school.edu');
  });
});
