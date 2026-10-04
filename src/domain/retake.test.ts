import { describe, expect, it } from 'vitest';
import type { PlacementAnswers } from './placement';
import { retake, questionsToAsk } from './retake';

const dollars = (n: number) => n * 100;

const maya: PlacementAnswers = {
  essentials: '250-499', // $400 a month
  savings: 'none',
  accounts: ['checking', 'regular-savings'],
  cardDebt: 'no',
  earnedIncome: true,
};

const noTx = (targetCents: number) => ({ targetCents, hasTransactions: false });
const withTx = (targetCents: number) => ({ targetCents, hasTransactions: true });

describe('questionsToAsk', () => {
  it('asks all 5 when the loaf has no transactions', () => {
    expect(questionsToAsk(false)).toEqual([
      'essentials',
      'existing-savings',
      'accounts',
      'card-debt',
      'earned-income',
    ]);
  });

  it('skips existing savings when the loaf already has transactions', () => {
    expect(questionsToAsk(true)).toEqual(['essentials', 'accounts', 'card-debt', 'earned-income']);
  });
});

describe('retake without existing transactions', () => {
  it('updates the profile, account steps, and keeps answers not retaken', () => {
    const r = retake({ current: maya, next: { accounts: ['high-yield-savings'] }, loaf: noTx(dollars(400)) });
    expect(r.answers).toMatchObject({ essentials: '250-499', accounts: ['high-yield-savings'] });
    expect(r.profile).toMatchObject({ placementStatus: 'complete', accounts: ['high-yield-savings'] });
    expect(r.needsHysaStep).toBe(false);
    expect(r.whereToKeepOptional).toBe(true);
  });

  it('suggests a new goal when new essentials change the starting point, without applying it', () => {
    const r = retake({ current: maya, next: { essentials: '500-749' }, loaf: noTx(dollars(400)) });
    expect(r.suggestedTargetCents).toBe(dollars(650));
  });

  it('uses the new existing-savings answer when recomputing', () => {
    const r = retake({
      current: maya,
      next: { savings: '500-999', savingsExactCents: dollars(650) },
      loaf: noTx(dollars(400)),
    });
    expect(r.answers.savings).toBe('500-999');
    expect(r.suggestedTargetCents).toBe(dollars(1200)); // $650 saved is over 1 month of $400: 3 month goal
  });

  it('suggests nothing when the answers that size the goal are unchanged, even if the goal was edited', () => {
    const r = retake({ current: maya, next: { cardDebt: 'yes' }, loaf: noTx(dollars(800)) });
    expect(r.suggestedTargetCents).toBeNull();
  });

  it('suggests nothing when the new answers give the goal it already has', () => {
    const r = retake({ current: maya, next: { essentials: '250-499' }, loaf: noTx(dollars(400)) });
    expect(r.suggestedTargetCents).toBeNull();
  });

  it('from skipped, answering essentials suggests 1 month of them, replacing the $1,000 default', () => {
    const r = retake({ current: {}, next: { essentials: '250-499' }, loaf: noTx(dollars(1000)) });
    expect(r.suggestedTargetCents).toBe(dollars(400));
    expect(r.profile.placementStatus).toBe('partial');
  });

  it('is complete once every question is answered after a skip', () => {
    const r = retake({ current: {}, next: maya, loaf: noTx(dollars(1000)) });
    expect(r.profile.placementStatus).toBe('complete');
  });
});

describe('retake with existing transactions', () => {
  it('keeps the existing-savings answer even if the retake supplies one', () => {
    const r = retake({
      current: { ...maya, savings: '100-249' },
      next: { savings: '1000-plus', savingsExactCents: dollars(5000), accounts: ['checking'] },
      loaf: withTx(dollars(400)),
    });
    expect(r.answers.savings).toBe('100-249');
    expect(r.answers.savingsExactCents).toBeUndefined();
    expect(r.answers.accounts).toEqual(['checking']);
  });

  it('re-prices the same number of months when the target was months-based', () => {
    const r = retake({ current: maya, next: { essentials: '500-749' }, loaf: withTx(dollars(400)) });
    expect(r.suggestedTargetCents).toBe(dollars(650)); // 1 month
    const three = retake({ current: maya, next: { essentials: '500-749' }, loaf: withTx(dollars(1200)) });
    expect(three.suggestedTargetCents).toBe(dollars(1950)); // 3 months
    const six = retake({ current: maya, next: { essentials: '500-749' }, loaf: withTx(dollars(2400)) });
    expect(six.suggestedTargetCents).toBe(dollars(3900)); // 6 months
  });

  it('if the target was the $1,000 default and essentials are now given, suggests 1 month of them', () => {
    const r = retake({ current: {}, next: { essentials: '500-749' }, loaf: withTx(dollars(1000)) });
    expect(r.suggestedTargetCents).toBe(dollars(650));
  });

  it('leaves a custom goal alone', () => {
    const r = retake({ current: maya, next: { essentials: '500-749' }, loaf: withTx(dollars(500)) });
    expect(r.suggestedTargetCents).toBeNull();
  });

  it('suggests nothing when essentials are still unknown', () => {
    const r = retake({ current: {}, next: { essentials: 'not-sure' }, loaf: withTx(dollars(1000)) });
    expect(r.suggestedTargetCents).toBeNull();
  });

  it('suggests nothing when essentials did not change', () => {
    const r = retake({ current: maya, next: { accounts: ['checking'] }, loaf: withTx(dollars(400)) });
    expect(r.suggestedTargetCents).toBeNull();
  });

  it('suggests nothing when there is no loaf', () => {
    const r = retake({ current: maya, next: { essentials: '500-749' }, loaf: null });
    expect(r.suggestedTargetCents).toBeNull();
  });
});
