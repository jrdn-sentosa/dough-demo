import { describe, expect, it } from 'vitest';
import { suggestHabits, suggestPerPaycheckCents, suggestWeeklyCents } from './habits';

describe('suggestWeeklyCents', () => {
  it('divides the target over 12 weeks, rounded up to $5', () => {
    expect(suggestWeeklyCents(40_000)).toBe(3_500); // $33.33 -> $35
    expect(suggestWeeklyCents(60_000)).toBe(5_000); // exactly $50
    expect(suggestWeeklyCents(60_100)).toBe(5_500);
  });

  it('is at least $5', () => {
    expect(suggestWeeklyCents(15_000)).toBe(1_500);
    expect(suggestWeeklyCents(1_000)).toBe(500);
    expect(suggestWeeklyCents(0)).toBe(500);
  });
});

describe('suggestPerPaycheckCents', () => {
  it('is 10% of each paycheck', () => {
    expect(suggestPerPaycheckCents(50_000)).toBe(5_000);
    expect(suggestPerPaycheckCents(33_333)).toBe(3_333);
  });
});

describe('suggestHabits', () => {
  it('offers both options', () => {
    expect(suggestHabits(40_000)).toEqual({ weeklyCents: 3_500, paycheckPercent: 10 });
  });
});
