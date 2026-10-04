import { describe, expect, it } from 'vitest';
import { getBreads } from '../../content/loader';
import type { Habit, PayFrequency } from '../../domain/habits';
import { streakView } from './streakView';

const copy = getBreads();
const weekly: Habit = { kind: 'weekly', amountCents: 1500, paycheckCents: null, frequency: null, startedAt: '2026-01-01T00:00:00.000Z' };
const paid = (frequency: PayFrequency): Habit => ({ kind: 'paycheck', amountCents: 5000, paycheckCents: 50000, frequency, startedAt: weekly.startedAt });
const view = (habit: Habit, streak: number, unlocked: Parameters<typeof streakView>[0]['unlocked'] = [], bestDays = 0) =>
  streakView({ habit, streak, unlocked, bestDays, copy });

describe('streakView', () => {
  it('shows no streak and the first unlock before any saving', () => {
    const v = view(weekly, 0);
    expect(v.value).toBe('No streak yet');
    expect(v.line).toBe('Baguette unlocks at 2 weeks of saving.');
    expect(v.pill).toBeNull();
  });

  it('shows the streak in its own unit', () => {
    expect(view(weekly, 4).value).toBe('4-week streak');
    expect(view(paid('weekly'), 4).value).toBe('4-week streak');
    expect(view(paid('biweekly'), 1).value).toBe('1 pay period');
    expect(view(paid('biweekly'), 3).value).toBe('3 pay periods');
    expect(view(paid('twice-monthly'), 3).value).toBe('3 pay periods');
    expect(view(paid('monthly'), 1).value).toBe('1 month');
    expect(view(paid('monthly'), 2).value).toBe('2 months');
    expect(view(paid('varies'), 2).value).toBe('2 months');
  });

  it('says what is unlocked and what comes next, in weeks', () => {
    expect(view(weekly, 4).line).toBe('Bagel unlocked. Focaccia next at 6 weeks.');
    expect(view(paid('biweekly'), 3).line).toBe('Focaccia unlocked. Pretzel next at 8 weeks.');
  });

  it('adds the weeks of saving when the unit is not weeks', () => {
    expect(view(paid('biweekly'), 3).pill).toBe('6 weeks');
    expect(view(paid('monthly'), 2).pill).toBe('8 weeks');
    expect(view(weekly, 3).pill).toBeNull();
  });

  it('says every bread is unlocked at the top of the ladder', () => {
    expect(view(weekly, 16).line).toBe('Every bread is unlocked. Nice steady saving.');
  });

  it('a streak that starts over says "New streak starts now." and keeps unlocked breads', () => {
    const v = view(weekly, 0, ['baguette', 'bagel'], 28);
    expect(v.value).toBe('New streak starts now.');
    expect(v.line).toBe('Your unlocked breads stay yours. Focaccia unlocks at 6 weeks of saving.');
    expect(v.latest).toBe('bagel');
  });

  it('never uses guilt words', () => {
    const texts = [view(weekly, 0, ['baguette'], 14), view(weekly, 0), view(weekly, 5), view(paid('monthly'), 1), view(weekly, 0, ['baguette', 'bagel', 'focaccia', 'pretzel', 'brioche', 'croissant'], 400)]
      .flatMap((v) => [v.value, v.line, v.pill ?? ''])
      .join(' ');
    expect(texts).not.toMatch(/lost|lose|broke|broken|failed|fail|ended/i);
  });
});
