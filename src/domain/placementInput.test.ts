import { describe, expect, it } from 'vitest';
import { DEFAULT_GOAL_CENTS } from './bands';
import { startingPoint } from './placement';
import { answersFromSelections, bakedStartTargetCents, toggleAccount } from './placementInput';

describe('toggleAccount', () => {
  it('adds and removes real accounts', () => {
    expect(toggleAccount([], 'checking')).toEqual(['checking']);
    expect(toggleAccount(['checking'], 'regular-savings')).toEqual(['checking', 'regular-savings']);
    expect(toggleAccount(['checking', 'regular-savings'], 'checking')).toEqual(['regular-savings']);
  });

  it('"None" and "Not sure" clear every other choice, and each other', () => {
    expect(toggleAccount(['checking', 'investment'], 'none')).toEqual(['none']);
    expect(toggleAccount(['checking'], 'not-sure')).toEqual(['not-sure']);
    expect(toggleAccount(['none'], 'not-sure')).toEqual(['not-sure']);
    expect(toggleAccount(['not-sure'], 'none')).toEqual(['none']);
  });

  it('picking a real account clears "None" and "Not sure"', () => {
    expect(toggleAccount(['none'], 'checking')).toEqual(['checking']);
    expect(toggleAccount(['not-sure'], 'checking')).toEqual(['checking']);
  });

  it('picking "None" again unpicks it', () => {
    expect(toggleAccount(['none'], 'none')).toEqual([]);
  });
});

describe('answersFromSelections', () => {
  it('leaves unpicked questions unknown', () => {
    expect(answersFromSelections({})).toEqual({});
    expect(answersFromSelections({ accounts: [] })).toEqual({});
  });

  it('maps every question', () => {
    expect(
      answersFromSelections({
        essentials: '500-749',
        'existing-savings': 'none',
        accounts: ['checking'],
        'card-debt': 'no-card',
        'earned-income': 'no',
      }),
    ).toEqual({ essentials: '500-749', savings: 'none', accounts: ['checking'], cardDebt: 'no-card', earnedIncome: false });
  });
});

describe('bakedStartTargetCents', () => {
  it('is the starter goal when essentials are unknown', () => {
    expect(bakedStartTargetCents(startingPoint({ savings: '1000-plus' }))).toBe(DEFAULT_GOAL_CENTS);
  });

  it('is 1 month when savings cover 1 to under 3 months (with card debt)', () => {
    const sp = startingPoint({ essentials: '250-499', savings: '1000-plus', cardDebt: 'yes' });
    expect(sp.emergencyFundBaked).toBe(true);
    expect(bakedStartTargetCents(sp)).toBe(sp.essentialsCents);
  });

  it('is 3 months when savings cover 3 months or more', () => {
    const sp = startingPoint({ essentials: 'under-250', savings: '1000-plus' });
    expect(sp.emergencyFundBaked).toBe(true);
    expect((bakedStartTargetCents(sp) as number) / (sp.essentialsCents as number)).toBe(3);
  });
});
