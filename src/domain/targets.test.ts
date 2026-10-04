import { describe, expect, it } from 'vitest';
import {
  creditedSavings,
  essentialsFigure,
  growGoal,
  monthsForTarget,
  roundUpToFifty,
  savingsMeetTarget,
  targetForMonths,
} from './targets';

describe('essentialsFigure', () => {
  it.each([
    ['under-250', 15_000],
    ['250-499', 40_000],
    ['500-749', 65_000],
    ['750-999', 90_000],
    ['1000-1499', 125_000],
  ])('%s uses the midpoint rounded up to $50', (id, cents) => {
    expect(essentialsFigure(id)).toEqual({ cents, needsExactInput: false });
  });

  it('open-ended band uses its lower bound and asks for an exact number', () => {
    expect(essentialsFigure('1500-plus')).toEqual({
      cents: 150_000,
      needsExactInput: true,
    });
  });

  it('open-ended band uses the typed amount, rounded up to $50', () => {
    expect(essentialsFigure('1500-plus', 183_210)).toEqual({
      cents: 185_000,
      needsExactInput: false,
    });
  });

  it('"Not sure" leaves essentials unknown instead of guessing a figure', () => {
    expect(essentialsFigure('not-sure')).toEqual({ cents: null, needsExactInput: false });
  });

  it('throws on an unknown band', () => {
    expect(() => essentialsFigure('nope')).toThrow();
  });
});

describe('growGoal', () => {
  it('is 3 months of essentials when essentials are known', () => {
    expect(growGoal(40_000)).toEqual({ needsEssentials: false, targetCents: 120_000 });
  });

  it('asks for essentials first when they are unknown', () => {
    expect(growGoal(null)).toEqual({ needsEssentials: true, targetCents: null });
  });
});

describe('roundUpToFifty', () => {
  it('keeps exact multiples and rounds everything else up', () => {
    expect(roundUpToFifty(5_000)).toBe(5_000);
    expect(roundUpToFifty(5_001)).toBe(10_000);
    expect(roundUpToFifty(0)).toBe(0);
  });
});

describe('targetForMonths', () => {
  it('multiplies monthly essentials', () => {
    expect(targetForMonths(40_000, 1)).toBe(40_000);
    expect(targetForMonths(40_000, 3)).toBe(120_000);
    expect(targetForMonths(40_000, 6)).toBe(240_000);
  });
});

describe('monthsForTarget', () => {
  it('divides the target by monthly essentials', () => {
    expect(monthsForTarget(40_000, 40_000)).toBe(1);
    expect(monthsForTarget(120_000, 40_000)).toBe(3);
    expect(monthsForTarget(240_000, 40_000)).toBe(6);
  });

  it('is 0 when essentials are 0', () => {
    expect(monthsForTarget(40_000, 0)).toBe(0);
  });
});

describe('creditedSavings', () => {
  it.each([
    ['none', 0],
    ['1-99', 100],
    ['100-249', 10_000],
    ['250-499', 25_000],
    ['500-999', 50_000],
    ['1000-plus', 100_000],
  ])('%s is credited at its lower bound', (id, cents) => {
    expect(creditedSavings(id)).toBe(cents);
  });

  it('an exact amount overrides the band', () => {
    expect(creditedSavings('250-499', 31_250)).toBe(31_250);
    expect(creditedSavings('250-499', 0)).toBe(0);
  });
});

describe('savingsMeetTarget', () => {
  it('is true at or above the target', () => {
    expect(savingsMeetTarget(40_000, 40_000)).toBe(true);
    expect(savingsMeetTarget(39_999, 40_000)).toBe(false);
  });

  it('is false for a zero target', () => {
    expect(savingsMeetTarget(0, 0)).toBe(false);
  });
});
