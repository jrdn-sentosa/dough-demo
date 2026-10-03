import { describe, expect, it } from 'vitest';
import { recommendNext } from './recommendations';

describe('recommendNext', () => {
  it('card debt recommends Debt payoff with the debt note, even with income', () => {
    expect(recommendNext({ cardDebt: 'yes', earnedIncome: true, accounts: ['checking'] })).toEqual({
      loaf: 'debt-payoff',
      debtNote: true,
      growTargetMonths: null,
    });
  });

  it('earned income and no retirement account recommends Roth IRA', () => {
    expect(
      recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['checking', 'regular-savings'] }),
    ).toEqual({ loaf: 'roth-ira', debtNote: false, growTargetMonths: null });
  });

  it('"no credit card" is not debt', () => {
    expect(recommendNext({ cardDebt: 'no-card', earnedIncome: true, accounts: [] }).loaf).toBe(
      'roth-ira',
    );
  });

  it('"not sure" about accounts counts as no retirement account', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['not-sure'] }).loaf).toBe(
      'roth-ira',
    );
  });

  it('a retirement account recommends Index funds', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['retirement'] }).loaf).toBe(
      'index-funds',
    );
  });

  it('never recommends Roth IRA without earned income', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: false, accounts: [] }).loaf).toBe(
      'index-funds',
    );
  });

  describe('growing a cushion under 3 months', () => {
    const base = { cardDebt: 'no', earnedIncome: true, accounts: ['checking'] } as const;
    const grow = { loaf: 'emergency-fund', debtNote: false, growTargetMonths: 3 };

    it('recommends growing to 3 months when the target that baked was under 3 months', () => {
      expect(recommendNext({ ...base, targetMonths: 1 })).toEqual(grow);
      expect(recommendNext({ ...base, targetMonths: 2.4 })).toEqual(grow);
    });

    it('comes before Roth IRA and Index funds', () => {
      expect(recommendNext({ ...base, earnedIncome: false, targetMonths: 1 })).toEqual(grow);
      expect(recommendNext({ ...base, accounts: ['retirement'], targetMonths: 1 })).toEqual(grow);
    });

    it('card debt still comes first', () => {
      expect(recommendNext({ ...base, cardDebt: 'yes', targetMonths: 1 })).toEqual({
        loaf: 'debt-payoff',
        debtNote: true,
        growTargetMonths: null,
      });
    });

    it('is skipped at 3 months or more', () => {
      expect(recommendNext({ ...base, targetMonths: 3 }).loaf).toBe('roth-ira');
      expect(recommendNext({ ...base, targetMonths: 6 }).loaf).toBe('roth-ira');
    });

    it('is skipped when the target months are null or missing', () => {
      expect(recommendNext({ ...base, targetMonths: null }).loaf).toBe('roth-ira');
      expect(recommendNext(base).loaf).toBe('roth-ira');
    });
  });
});
