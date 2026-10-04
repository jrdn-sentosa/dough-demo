import { describe, expect, it } from 'vitest';
import { monthsCovered, startingPoint } from './placement';
import type { PlacementAnswers } from './placement';

const maya: PlacementAnswers = {
  essentials: '250-499',
  savings: 'none',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

function answers(overrides: Partial<PlacementAnswers>): PlacementAnswers {
  return { ...maya, ...overrides };
}

describe('monthsCovered', () => {
  it('is savings divided by essentials', () => {
    expect(monthsCovered(60_000, 40_000)).toBe(1.5);
    expect(monthsCovered(0, 40_000)).toBe(0);
  });

  it('is 0 when essentials are 0', () => {
    expect(monthsCovered(10_000, 0)).toBe(0);
  });
});

describe('startingPoint: loaf and target', () => {
  it("Maya: under 1 month starts the emergency fund at a $400, 1 month target", () => {
    const s = startingPoint(maya);
    expect(s.firstLoaf).toBe('emergency-fund');
    expect(s.targetMonths).toBe(1);
    expect(s.targetCents).toBe(40_000);
    expect(s.emergencyFundBaked).toBe(false);
    expect(s.nextLoaf).toBeNull();
    expect(s.countSavingsByDefault).toBe(false);
    expect(s.startStage).toBe('mix');
  });

  it('just under 1 month is still 1 month', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: '500-999' })); // $500 of $650
    expect(s.targetMonths).toBe(1);
    expect(s.monthsCovered).toBeLessThan(1);
  });

  it('exactly 1 month moves to the 3 month target, savings counted', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: '500-999', savingsExactCents: 65_000 }));
    expect(s.monthsCovered).toBe(1);
    expect(s.targetMonths).toBe(3);
    expect(s.targetCents).toBe(195_000);
    expect(s.countSavingsByDefault).toBe(true);
    expect(s.startPercent).toBe(33);
    expect(s.startStage).toBe('shape');
  });

  it('1 to under 3 months, no debt: emergency fund, 3 months, starts partly risen', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: '1000-plus' })); // $1,000 of $650/mo
    expect(s.firstLoaf).toBe('emergency-fund');
    expect(s.targetMonths).toBe(3);
    expect(s.countSavingsByDefault).toBe(true);
    expect(s.startPercent).toBe(51);
    expect(s.startStage).toBe('proof');
    expect(s.emergencyFundBaked).toBe(false);
  });

  it('1 to under 3 months, card debt: baked, recommend Debt payoff', () => {
    const s = startingPoint(
      answers({ essentials: '500-749', savings: '1000-plus', cardDebt: 'yes' }),
    );
    expect(s.firstLoaf).toBeNull();
    expect(s.targetMonths).toBeNull();
    expect(s.targetCents).toBeNull();
    expect(s.emergencyFundBaked).toBe(true);
    expect(s.nextLoaf).toMatchObject({ loaf: 'debt-payoff', debtNote: true, growTargetMonths: null });
  });

  it('"no credit card" is not card debt', () => {
    const s = startingPoint(
      answers({ essentials: '500-749', savings: '1000-plus', cardDebt: 'no-card' }),
    );
    expect(s.firstLoaf).toBe('emergency-fund');
  });

  it('3+ months: baked, then ChooseLoaf rules', () => {
    const base = answers({ essentials: 'under-250', savings: '1000-plus' }); // $1,000 of $150/mo
    expect(startingPoint(base).emergencyFundBaked).toBe(true);
    expect(startingPoint(base).nextLoaf?.loaf).toBe('roth-ira');
    expect(startingPoint({ ...base, cardDebt: 'yes' }).nextLoaf?.loaf).toBe('debt-payoff');
    expect(startingPoint({ ...base, accounts: ['retirement'] }).nextLoaf?.loaf).toBe('index-funds');
    expect(startingPoint({ ...base, earnedIncome: false }).nextLoaf?.loaf).toBe('index-funds');
  });

  it('exactly 3 months counts as baked', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: 'none', savingsExactCents: 195_000 }));
    expect(s.monthsCovered).toBe(3);
    expect(s.emergencyFundBaked).toBe(true);
  });

  it('just under 3 months is not baked', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: 'none', savingsExactCents: 194_999 }));
    expect(s.emergencyFundBaked).toBe(false);
  });
});

describe('startingPoint: essentials figures', () => {
  it('"Not sure" starts at the $1,000 default goal, flagged isDefault, with essentials unknown', () => {
    const s = startingPoint(answers({ essentials: 'not-sure' }));
    expect(s.isDefault).toBe(true);
    expect(s.targetCents).toBe(100_000);
    expect(s.essentialsCents).toBeNull();
    expect(s.targetMonths).toBeNull();
  });

  it('a known essentials band is not a default', () => {
    expect(startingPoint(maya).isDefault).toBe(false);
  });

  it('open-ended band asks for an exact number until one is typed', () => {
    expect(startingPoint(answers({ essentials: '1500-plus' })).needsExactInput).toBe(true);
    const typed = startingPoint(answers({ essentials: '1500-plus', essentialsExactCents: 210_000 }));
    expect(typed.needsExactInput).toBe(false);
    expect(typed.targetCents).toBe(210_000);
  });

  it('monthsCovered uses the target-sizing essentials figure', () => {
    const s = startingPoint(answers({ essentials: '500-749', savings: '250-499' }));
    expect(s.monthsCovered).toBeCloseTo(0.385, 2); // $250 / $650
  });

  it('does not compute monthsCovered when essentials are unknown', () => {
    expect(startingPoint(answers({ essentials: 'not-sure', savings: '250-499' })).monthsCovered).toBeNull();
    expect(startingPoint({}).monthsCovered).toBeNull();
  });
});

describe('startingPoint: account rules', () => {
  it('no savings account of any kind needs the high-yield step', () => {
    for (const accounts of [['none'], ['not-sure'], ['checking'], ['retirement', 'investment']] as const) {
      expect(startingPoint(answers({ accounts })).needsHysaStep).toBe(true);
    }
  });

  it('regular savings skips the step but keeps ef-where-to-keep required', () => {
    const s = startingPoint(answers({ accounts: ['regular-savings'] }));
    expect(s.needsHysaStep).toBe(false);
    expect(s.whereToKeepOptional).toBe(false);
  });

  it('high-yield savings skips the step and makes ef-where-to-keep optional', () => {
    const s = startingPoint(answers({ accounts: ['checking', 'high-yield-savings'] }));
    expect(s.needsHysaStep).toBe(false);
    expect(s.whereToKeepOptional).toBe(true);
  });

  it('investments under 3 months still start the emergency fund, with the note', () => {
    const s = startingPoint(answers({ accounts: ['checking', 'investment'] }));
    expect(s.firstLoaf).toBe('emergency-fund');
    expect(s.showInvestmentNote).toBe(true);
  });

  it('no investment note without investments, or once the fund is baked', () => {
    expect(startingPoint(maya).showInvestmentNote).toBe(false);
    const baked = startingPoint(
      answers({ essentials: 'under-250', savings: '1000-plus', accounts: ['investment'] }),
    );
    expect(baked.showInvestmentNote).toBe(false);
  });
});
