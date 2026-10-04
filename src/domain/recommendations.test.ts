import { describe, expect, it } from 'vitest';
import { recommendNext } from './recommendations';

const roth = {
  loaf: 'roth-ira',
  needsPersonalization: false,
  debtNote: false,
  growTargetMonths: null,
  growNeedsEssentials: false,
};

const personalize = {
  loaf: null,
  needsPersonalization: true,
  debtNote: false,
  growTargetMonths: null,
  growNeedsEssentials: false,
};

describe('recommendNext', () => {
  it('card debt recommends Debt payoff with the debt note, even with income', () => {
    expect(recommendNext({ cardDebt: 'yes', earnedIncome: true, accounts: ['checking'] })).toEqual({
      loaf: 'debt-payoff',
      needsPersonalization: false,
      debtNote: true,
      growTargetMonths: null,
      growNeedsEssentials: false,
    });
  });

  it('earned income and no retirement account recommends Roth IRA', () => {
    expect(
      recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['checking', 'regular-savings'] }),
    ).toEqual(roth);
  });

  it('"no credit card" is not debt', () => {
    expect(recommendNext({ cardDebt: 'no-card', earnedIncome: true, accounts: [] }).loaf).toBe('roth-ira');
  });

  it('"not sure" about accounts counts as no retirement account', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['not-sure'] }).loaf).toBe('roth-ira');
  });

  it('a retirement account recommends Index funds', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['retirement'] }).loaf).toBe(
      'index-funds',
    );
  });

  it('never recommends Roth IRA without earned income', () => {
    expect(recommendNext({ cardDebt: 'no', earnedIncome: false, accounts: [] }).loaf).toBe('index-funds');
  });

  describe('growing a cushion under 3 months', () => {
    const base = { cardDebt: 'no', earnedIncome: true, accounts: ['checking'] } as const;
    const grow = {
      loaf: 'emergency-fund',
      needsPersonalization: false,
      debtNote: false,
      growTargetMonths: 3,
      growNeedsEssentials: false,
    };

    it('recommends growing to 3 months when the target that baked was under 3 months', () => {
      expect(recommendNext({ ...base, targetMonths: 1 })).toEqual(grow);
      expect(recommendNext({ ...base, targetMonths: 2.4 })).toEqual(grow);
    });

    it('comes before Roth IRA and Index funds', () => {
      expect(recommendNext({ ...base, earnedIncome: false, targetMonths: 1 })).toEqual(grow);
      expect(recommendNext({ ...base, accounts: ['retirement'], targetMonths: 1 })).toEqual(grow);
    });

    it('card debt still comes first', () => {
      expect(recommendNext({ ...base, cardDebt: 'yes', targetMonths: 1 }).loaf).toBe('debt-payoff');
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

  describe('with unknown answers', () => {
    it('unknown card debt asks for personalization instead of a recommendation', () => {
      expect(recommendNext({ earnedIncome: true, accounts: ['checking'] })).toEqual(personalize);
      expect(recommendNext({})).toEqual(personalize);
    });

    it('unknown card debt never reaches Index funds, even with a retirement account or no income', () => {
      expect(recommendNext({ accounts: ['retirement'] })).toEqual(personalize);
      expect(recommendNext({ earnedIncome: false })).toEqual(personalize);
    });

    it('unknown earned income never recommends Roth IRA', () => {
      expect(recommendNext({ cardDebt: 'no', accounts: ['checking'] })).toEqual(personalize);
      expect(recommendNext({ cardDebt: 'no-card', accounts: [] })).toEqual(personalize);
    });

    it('unknown accounts never recommend Roth IRA, even with earned income', () => {
      expect(recommendNext({ cardDebt: 'no', earnedIncome: true })).toEqual(personalize);
    });

    it('unknown earned income is fine when a retirement account makes it Index funds anyway', () => {
      expect(recommendNext({ cardDebt: 'no', accounts: ['retirement'] }).loaf).toBe('index-funds');
    });

    it('unknown accounts are fine when there is no earned income, so Index funds', () => {
      expect(recommendNext({ cardDebt: 'no', earnedIncome: false }).loaf).toBe('index-funds');
    });

    it('known answers still recommend normally', () => {
      expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: ['checking'] })).toEqual(roth);
    });

    it('card debt "yes" still recommends Debt payoff when everything else is unknown', () => {
      expect(recommendNext({ cardDebt: 'yes' }).loaf).toBe('debt-payoff');
    });

    it('Grow still works with every other answer unknown, since it only depends on the target', () => {
      expect(recommendNext({ targetMonths: 1 })).toMatchObject({
        loaf: 'emergency-fund',
        growTargetMonths: 3,
        needsPersonalization: false,
      });
    });

    it('Debt payoff still beats Grow', () => {
      expect(recommendNext({ cardDebt: 'yes', targetMonths: 1 }).loaf).toBe('debt-payoff');
    });
  });

  describe('when the target was the starter goal', () => {
    it('recommends Grow, and says essentials are needed first', () => {
      expect(recommendNext({ cardDebt: 'no', earnedIncome: true, accounts: [], targetIsDefault: true })).toEqual({
        loaf: 'emergency-fund',
        needsPersonalization: false,
        debtNote: false,
        growTargetMonths: 3,
        growNeedsEssentials: true,
      });
    });

    it('works with every other answer unknown', () => {
      expect(recommendNext({ targetIsDefault: true })).toMatchObject({ growNeedsEssentials: true });
    });

    it('card debt "yes" still comes first', () => {
      expect(recommendNext({ cardDebt: 'yes', targetIsDefault: true }).loaf).toBe('debt-payoff');
    });
  });
});
