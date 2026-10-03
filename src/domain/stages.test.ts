import { describe, expect, it } from 'vitest';
import { growthPercent, progressPercent, stageForBalance, stageForPercent } from './stages';

describe('growthPercent', () => {
  // A fund baked at $400 is being grown to $1,200: the new part is $800.
  it('starts at 0, a dough ball, when the fund has just reached the old target', () => {
    expect(growthPercent(40_000, 40_000, 120_000)).toBe(0);
    expect(stageForPercent(growthPercent(40_000, 40_000, 120_000))).toBe('mix');
  });

  it('counts the new part only', () => {
    expect(growthPercent(60_000, 40_000, 120_000)).toBe(25);
    expect(growthPercent(80_000, 40_000, 120_000)).toBe(50);
    expect(growthPercent(100_000, 40_000, 120_000)).toBe(75);
  });

  it('is 100 at the new target and clamps above it', () => {
    expect(growthPercent(120_000, 40_000, 120_000)).toBe(100);
    expect(growthPercent(150_000, 40_000, 120_000)).toBe(100);
  });

  it('is 0 when the balance is under the old target or the target is not bigger', () => {
    expect(growthPercent(30_000, 40_000, 120_000)).toBe(0);
    expect(growthPercent(50_000, 120_000, 120_000)).toBe(0);
  });
});

describe('stageForPercent', () => {
  it.each([
    [0, 'mix'],
    [24, 'mix'],
    [25, 'shape'],
    [49, 'shape'],
    [50, 'proof'],
    [74, 'proof'],
    [75, 'bake'],
    [99, 'bake'],
    [100, 'baked'],
  ])('%i%% is %s', (percent, stage) => {
    expect(stageForPercent(percent)).toBe(stage);
  });
});

describe('progressPercent', () => {
  it('floors so the loaf never shows more than the student has', () => {
    expect(progressPercent(39_999, 40_000)).toBe(99);
    expect(progressPercent(9_999, 40_000)).toBe(24);
    expect(progressPercent(10_000, 40_000)).toBe(25);
  });

  it('clamps to 0-100', () => {
    expect(progressPercent(50_000, 40_000)).toBe(100);
    expect(progressPercent(-500, 40_000)).toBe(0);
  });

  it('is 0 for a zero target', () => {
    expect(progressPercent(10_000, 0)).toBe(0);
  });
});

describe('stageForBalance', () => {
  it("matches Maya's seed: $240 of $400 is Proof", () => {
    expect(stageForBalance(24_000, 40_000)).toBe('proof');
  });

  it('shrinks when a withdrawal lowers the balance', () => {
    expect(stageForBalance(30_000, 40_000)).toBe('bake');
    expect(stageForBalance(30_000 - 12_000, 40_000)).toBe('shape');
  });

  it('is Baked at or over the target', () => {
    expect(stageForBalance(40_000, 40_000)).toBe('baked');
    expect(stageForBalance(45_000, 40_000)).toBe('baked');
  });
});
