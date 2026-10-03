import { describe, expect, it } from 'vitest';
import { recommendNext } from './recommendations';

describe('recommendNext', () => {
  it('card debt recommends Debt payoff with the debt note, even with income', () => {
    expect(recommendNext({ cardDebt: 'yes', earnedIncome: true, accounts: ['checking'] })).toEqual({
      loaf: 'debt-payoff',
      debtNote: true,
    });
  });

  it('earned income and no retirement account recommends Roth IRA', () => {
    expect(
      recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['checking', 'regular-savings'] }),
    ).toEqual({ loaf: 'roth-ira', debtNote: false });
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
});
