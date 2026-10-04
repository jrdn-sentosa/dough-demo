import { describe, expect, it } from 'vitest';
import { recommendNext } from './recommendations';

const base = { cardDebt: 'no', earnedIncome: true, accounts: ['checking'] } as const;

describe('recommendNext: which path gets the Recommended pill', () => {
  describe('a fund that covered under 3 months', () => {
    it('recommends Keep saving: grow to 3 months', () => {
      expect(recommendNext({ ...base, targetMonths: 1 })).toEqual({
        path: 'save',
        needsPersonalization: false,
        debtNote: false,
        debtUnknown: false,
        growTargetMonths: 3,
        growNeedsEssentials: false,
      });
      expect(recommendNext({ ...base, targetMonths: 2.4 }).path).toBe('save');
    });

    it('comes first, whatever the other answers say', () => {
      expect(recommendNext({ ...base, accounts: ['retirement'], targetMonths: 1 }).path).toBe('save');
      expect(recommendNext({ ...base, earnedIncome: false, targetMonths: 1 }).path).toBe('save');
    });

    it('still comes first with card debt, which only adds the debt note for the invest path', () => {
      expect(recommendNext({ ...base, cardDebt: 'yes', targetMonths: 1 })).toMatchObject({
        path: 'save',
        debtNote: true,
        growTargetMonths: 3,
      });
    });

    it('only depends on the target, so every unknown answer is fine', () => {
      expect(recommendNext({ targetMonths: 1 })).toMatchObject({
        path: 'save',
        needsPersonalization: false,
        debtUnknown: true,
        growTargetMonths: 3,
      });
    });
  });

  describe('the starter goal', () => {
    it('recommends Keep saving and says essentials are needed first', () => {
      expect(recommendNext({ ...base, targetIsDefault: true })).toMatchObject({
        path: 'save',
        growTargetMonths: 3,
        growNeedsEssentials: true,
      });
    });

    it('works with every other answer unknown, and with card debt yes', () => {
      expect(recommendNext({ targetIsDefault: true })).toMatchObject({ path: 'save', growNeedsEssentials: true });
      expect(recommendNext({ cardDebt: 'yes', targetIsDefault: true })).toMatchObject({ path: 'save', debtNote: true });
    });
  });

  describe('a fund that covered 3 months or more', () => {
    it('recommends Start investing, and offers Grow to 6 months below 6 months (never recommended)', () => {
      expect(recommendNext({ ...base, targetMonths: 3 })).toEqual({
        path: 'invest',
        needsPersonalization: false,
        debtNote: false,
        debtUnknown: false,
        growTargetMonths: 6,
        growNeedsEssentials: false,
      });
      expect(recommendNext({ ...base, targetMonths: 5.9 })).toMatchObject({ path: 'invest', growTargetMonths: 6 });
    });

    it('does not offer Keep saving at 6 months or more', () => {
      expect(recommendNext({ ...base, targetMonths: 6 })).toMatchObject({ path: 'invest', growTargetMonths: null });
      expect(recommendNext({ ...base, targetMonths: 9 }).growTargetMonths).toBeNull();
    });

    it('does not offer Keep saving when the months are not known', () => {
      expect(recommendNext({ ...base, targetMonths: null }).growTargetMonths).toBeNull();
      expect(recommendNext(base).growTargetMonths).toBeNull();
    });

    it('"no credit card" is not debt', () => {
      expect(recommendNext({ ...base, cardDebt: 'no-card', targetMonths: 3 })).toMatchObject({ path: 'invest', debtNote: false });
    });

    it('card debt yes: no pill, and the debt note is set', () => {
      expect(recommendNext({ ...base, cardDebt: 'yes', targetMonths: 3 })).toMatchObject({
        path: null,
        debtNote: true,
        needsPersonalization: false,
        growTargetMonths: 6,
      });
    });

    it('card debt unknown: no pill, personalize (the debt check is never skipped)', () => {
      expect(recommendNext({ earnedIncome: true, accounts: ['checking'], targetMonths: 3 })).toMatchObject({
        path: null,
        needsPersonalization: true,
        debtUnknown: true,
      });
      expect(recommendNext({})).toMatchObject({ path: null, needsPersonalization: true });
    });

    it('does not need earned income or accounts to recommend investing, since the risk quiz handles those', () => {
      expect(recommendNext({ cardDebt: 'no', targetMonths: 3 }).path).toBe('invest');
    });
  });
});
