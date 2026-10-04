import { beforeEach, describe, expect, it } from 'vitest';
import { advance } from '../money/clock';
import { deposit, startLoaf, withdraw } from '../money/ledger';
import type { DataAdapter } from './adapter';
import { saveHabit } from './habit';
import { createMemoryAdapter } from './memoryAdapter';
import { emptyData } from './types';
import { breadChoices, markUnlockSeen, streakFromData, syncStreaks, unseenUnlock, unlockedBreads } from './streaks';

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;

let adapter: DataAdapter;

/** One simulated week: a deposit, then the clock moves on 7 days. */
async function saveAWeek() {
  await deposit(adapter, EF, dollars(20));
  await advance(adapter, 7);
}

beforeEach(async () => {
  adapter = createMemoryAdapter();
  await startLoaf(adapter, EF, dollars(5000));
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(20) });
});

describe('syncStreaks', () => {
  it('does nothing without a habit', async () => {
    const bare = createMemoryAdapter();
    expect(await syncStreaks(bare)).toEqual({ fresh: [], changed: false });
  });

  it('writes nothing while the streak has reached no bread and no new best', async () => {
    expect(await syncStreaks(adapter)).toEqual({ fresh: [], changed: false });
    expect((await adapter.load()).streaks).toEqual({ unlocked: [], bestDays: 0 });
  });

  it('unlocks the baguette at 2 weeks, unseen, and records the best streak', async () => {
    await saveAWeek();
    await saveAWeek();
    const result = await syncStreaks(adapter);
    expect(result).toEqual({ fresh: ['baguette'], changed: true });
    const { streaks } = await adapter.load();
    expect(streaks.bestDays).toBe(14);
    expect(streaks.unlocked).toHaveLength(1);
    expect(streaks.unlocked[0]).toMatchObject({ bread: 'baguette', seen: false });
  });

  it('is safe to call again: nothing new is written or unlocked', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    expect(await syncStreaks(adapter)).toEqual({ fresh: [], changed: false });
    expect(unlockedBreads(await adapter.load())).toEqual(['baguette']);
  });

  it('raises the best streak without a new unlock', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    await saveAWeek();
    expect(await syncStreaks(adapter)).toEqual({ fresh: [], changed: true });
    expect((await adapter.load()).streaks.bestDays).toBe(21);
  });

  it('unlocks every bread a streak has reached at once, in ladder order', async () => {
    for (let i = 0; i < 4; i++) await saveAWeek();
    const result = await syncStreaks(adapter);
    expect(result.fresh).toEqual(['baguette', 'bagel']);
  });

  it('keeps unlocks and the best streak when the streak starts over', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    await advance(adapter, 21);
    const data = await adapter.load();
    expect(streakFromData(data)).toBe(0);
    expect(await syncStreaks(adapter)).toEqual({ fresh: [], changed: false });
    const after = await adapter.load();
    expect(unlockedBreads(after)).toEqual(['baguette']);
    expect(after.streaks.bestDays).toBe(14);
  });

  it('never lets a withdrawal break a streak', async () => {
    await saveAWeek();
    await saveAWeek();
    await withdraw(adapter, EF, dollars(10));
    expect(streakFromData(await adapter.load())).toBe(2);
  });
});

describe('unlock moment', () => {
  it('reports the first unseen unlock until it is dismissed, once', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    expect(unseenUnlock(await adapter.load())).toBe('baguette');
    await markUnlockSeen(adapter, 'baguette');
    expect(unseenUnlock(await adapter.load())).toBeNull();
    await markUnlockSeen(adapter, 'baguette');
    expect((await adapter.load()).streaks.unlocked).toHaveLength(1);
  });
});

describe('breadChoices', () => {
  it('offers only the default bread, with no real choice, before anything is unlocked', async () => {
    const choices = breadChoices(await adapter.load());
    expect(choices.available).toEqual(['sandwich']);
    expect(choices.hasChoice).toBe(false);
  });

  it('offers the default plus unlocked breads, in ladder order', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    const choices = breadChoices(await adapter.load());
    expect(choices.available).toEqual(['sandwich', 'baguette']);
    expect(choices.hasChoice).toBe(true);
  });

  it('counts whole weeks left for a locked bread, and 0 for the ones that are open', async () => {
    await saveAWeek();
    await saveAWeek();
    await syncStreaks(adapter);
    const { weeksLeft } = breadChoices(await adapter.load());
    expect(weeksLeft('sandwich')).toBe(0);
    expect(weeksLeft('baguette')).toBe(0);
    expect(weeksLeft('bagel')).toBe(2);
    expect(weeksLeft('croissant')).toBe(14);
  });

  it('falls back to the ladder weeks when there is no habit yet', () => {
    const { weeksLeft } = breadChoices(emptyData());
    expect(weeksLeft('bagel')).toBe(4);
  });
});

