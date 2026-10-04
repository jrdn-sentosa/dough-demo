import { describe, expect, it } from 'vitest';
import { DEFAULT_GOAL_CENTS } from './bands';
import { startingPoint } from './placement';
import type { PlacementAnswers } from './placement';
import { answersFromProfile, placementStatus, profileFromAnswers } from './profile';

const full: PlacementAnswers = {
  essentials: '250-499',
  savings: 'none',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

describe('skipping at the start', () => {
  const s = startingPoint({});

  it('starts the emergency fund at the $1,000 default goal, flagged isDefault', () => {
    expect(DEFAULT_GOAL_CENTS).toBe(100_000);
    expect(s).toMatchObject({
      firstLoaf: 'emergency-fund',
      targetCents: 100_000,
      isDefault: true,
      emergencyFundBaked: false,
    });
  });

  it('starts as a dough ball, with no savings counted', () => {
    expect(s).toMatchObject({
      existingSavingsCents: 0,
      countSavingsByDefault: false,
      startPercent: 0,
      startStage: 'mix',
    });
  });

  it('leaves essentials and months unknown instead of guessing them', () => {
    expect(s).toMatchObject({ essentialsCents: null, monthsCovered: null, targetMonths: null });
  });

  it('includes the high-yield step and keeps ef-where-to-keep recommended', () => {
    expect(s).toMatchObject({ needsHysaStep: true, whereToKeepOptional: false });
  });

  it('has no investment note, since accounts are unknown', () => {
    expect(s.showInvestmentNote).toBe(false);
  });

  it('is stored as skipped, with every field unknown', () => {
    expect(profileFromAnswers({})).toEqual({
      placementStatus: 'skipped',
      essentials: null,
      essentialsExactCents: null,
      essentialsCents: null,
      savings: null,
      savingsExactCents: null,
      accounts: null,
      cardDebt: null,
      earnedIncome: null,
      monthsCovered: null,
    });
  });
});

describe('skipping partway', () => {
  it('keeps essentials and savings already given, and defaults only the rest', () => {
    const s = startingPoint({ essentials: '500-749', savings: '250-499' });
    expect(s).toMatchObject({
      essentialsCents: 65_000,
      isDefault: false,
      targetCents: 65_000,
      existingSavingsCents: 25_000,
      needsHysaStep: true,
    });
    expect(s.monthsCovered).toBeCloseTo(0.385, 2);
  });

  it('keeps accounts already given: a high-yield account skips the step', () => {
    const s = startingPoint({ accounts: ['high-yield-savings'] });
    expect(s).toMatchObject({ needsHysaStep: false, whereToKeepOptional: true, isDefault: true });
  });

  it('keeps the card debt answer when other answers are missing', () => {
    expect(startingPoint({ cardDebt: 'yes', savings: '1000-plus' }).nextLoaf).toMatchObject({
      loaf: 'debt-payoff',
    });
  });

  it('is stored as partial, keeping the answers given', () => {
    const profile = profileFromAnswers({ essentials: '250-499', cardDebt: 'no' });
    expect(profile).toMatchObject({
      placementStatus: 'partial',
      essentials: '250-499',
      essentialsCents: 40_000,
      cardDebt: 'no',
      savings: null,
      accounts: null,
      earnedIncome: null,
    });
    expect(answersFromProfile(profile)).toEqual({ essentials: '250-499', cardDebt: 'no' });
  });

  it('"Not sure" about essentials counts as answered but leaves essentials unknown', () => {
    const profile = profileFromAnswers({ ...full, essentials: 'not-sure' });
    expect(profile).toMatchObject({ placementStatus: 'complete', essentialsCents: null, monthsCovered: null });
  });
});

describe('placementStatus', () => {
  it('is complete when all 5 questions are answered', () => {
    expect(placementStatus(full)).toBe('complete');
  });

  it('is partial with some answers, skipped with none', () => {
    expect(placementStatus({ earnedIncome: false })).toBe('partial');
    expect(placementStatus({ ...full, earnedIncome: undefined })).toBe('partial');
    expect(placementStatus({})).toBe('skipped');
  });
});

describe('the starter goal when essentials are unknown', () => {
  it('counts existing savings toward it, so the loaf starts partly risen', () => {
    const s = startingPoint({ savings: '250-499' });
    expect(s).toMatchObject({
      targetCents: 100_000,
      countSavingsByDefault: true,
      startPercent: 25,
      startStage: 'shape',
      emergencyFundBaked: false,
    });
  });

  it('counts the exact savings amount when one is given', () => {
    const s = startingPoint({ savings: '500-999', savingsExactCents: 87_500 });
    expect(s.startPercent).toBe(87);
    expect(s.startStage).toBe('bake');
  });

  it('counts as baked ("Already built") when savings already meet $1,000', () => {
    const s = startingPoint({ savings: '1000-plus', cardDebt: 'no', earnedIncome: true, accounts: [] });
    expect(s).toMatchObject({ emergencyFundBaked: true, firstLoaf: null, targetCents: null, isDefault: true });
  });

  it('is not baked just under $1,000', () => {
    const s = startingPoint({ savings: '500-999', savingsExactCents: 99_999 });
    expect(s.emergencyFundBaked).toBe(false);
  });

  it('recommends growing the cushion once baked, and says essentials are needed first', () => {
    const s = startingPoint({ savings: '1000-plus', cardDebt: 'no', earnedIncome: true, accounts: [] });
    expect(s.nextLoaf).toMatchObject({
      loaf: 'emergency-fund',
      growTargetMonths: 3,
      growNeedsEssentials: true,
    });
  });

  it('recommends Debt payoff first when card debt is yes', () => {
    const s = startingPoint({ savings: '1000-plus', cardDebt: 'yes' });
    expect(s.nextLoaf).toMatchObject({ loaf: 'debt-payoff', debtNote: true });
  });
});
