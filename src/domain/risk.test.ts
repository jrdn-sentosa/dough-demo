import { describe, expect, it } from 'vitest';
import { DROP_REACTIONS, EXPERIENCES, HORIZONS, PRIORITIES, comfortScore, riskRecord, riskResult, riskStatus } from './risk';
import type { RiskAnswers } from './risk';

const long: RiskAnswers = { horizon: 'over-five', drop: 'wait', priority: 'balance', experience: 'little' };

describe('riskStatus', () => {
  it('is complete, partial or skipped, like placement', () => {
    expect(riskStatus(long)).toBe('complete');
    expect(riskStatus({ horizon: 'over-five' })).toBe('partial');
    expect(riskStatus({ experience: 'none' })).toBe('partial');
    expect(riskStatus({})).toBe('skipped');
  });
});

describe('the horizon', () => {
  it('under 3 years suggests keeping it in savings, whatever the other answers say', () => {
    for (const horizon of ['within-year', 'one-to-three'] as const) {
      for (const drop of DROP_REACTIONS) {
        for (const priority of PRIORITIES) {
          const r = riskResult({ horizon, drop, priority, experience: 'yes' }, { earnedIncome: true });
          expect(r).toMatchObject({ keepSavings: true, approach: null, loaf: null, where: null });
        }
      }
    }
  });

  it('3 years or more is not a savings suggestion', () => {
    expect(riskResult({ horizon: 'three-to-five' }).keepSavings).toBe(false);
    expect(riskResult({ horizon: 'over-five' }).keepSavings).toBe(false);
  });

  it('an unknown horizon is never treated as short', () => {
    expect(riskResult({ drop: 'sell-all' }).keepSavings).toBe(false);
    expect(riskResult({}).keepSavings).toBe(false);
  });
});

describe('steadier or growth-focused', () => {
  it('comfort comes from questions 2 and 3 only', () => {
    expect(comfortScore({})).toBe(0);
    expect(comfortScore({ drop: 'sell-all', priority: 'not-losing' })).toBe(0);
    expect(comfortScore({ drop: 'add-more', priority: 'growth' })).toBe(5);
    expect(comfortScore({ drop: 'wait', priority: 'balance', experience: 'yes', horizon: 'over-five' })).toBe(3);
  });

  it('over 5 years: comfort of 3 or more is growth-focused (index funds), less is steadier (bonds)', () => {
    expect(riskResult({ horizon: 'over-five', drop: 'wait', priority: 'balance' })).toMatchObject({ approach: 'growth', loaf: 'index-funds' });
    expect(riskResult({ horizon: 'over-five', drop: 'sell-some', priority: 'balance' })).toMatchObject({ approach: 'steady', loaf: 'bonds' });
    expect(riskResult({ horizon: 'over-five', drop: 'sell-all', priority: 'growth' })).toMatchObject({ approach: 'steady', loaf: 'bonds' });
    expect(riskResult({ horizon: 'over-five', drop: 'sell-some', priority: 'growth' })).toMatchObject({ approach: 'growth' });
  });

  it('3 to 5 years leans steadier: it needs comfort of 4 for growth', () => {
    expect(riskResult({ horizon: 'three-to-five', drop: 'wait', priority: 'balance' })).toMatchObject({ approach: 'steady', loaf: 'bonds' });
    expect(riskResult({ horizon: 'three-to-five', drop: 'wait', priority: 'growth' })).toMatchObject({ approach: 'growth', loaf: 'index-funds' });
  });

  it('skipped questions take the most cautious answer: steadier', () => {
    expect(riskResult({ horizon: 'over-five' })).toMatchObject({ approach: 'steady', loaf: 'bonds' });
    expect(riskResult({ horizon: 'over-five', drop: 'add-more' })).toMatchObject({ approach: 'growth' });
    expect(riskResult({ drop: 'add-more', priority: 'growth' })).toMatchObject({ approach: 'growth' });
    expect(riskResult({})).toMatchObject({ approach: 'steady', loaf: 'bonds' });
  });

  it('question 4 never changes the approach', () => {
    for (const horizon of HORIZONS) {
      for (const drop of DROP_REACTIONS) {
        for (const priority of PRIORITIES) {
          const results = EXPERIENCES.map((experience) => riskResult({ horizon, drop, priority, experience }).approach);
          expect(new Set(results).size).toBe(1);
        }
      }
    }
  });

  it('question 4 only changes the wording: start small unless they have invested before', () => {
    expect(riskResult({ ...long, experience: 'none' }).startSmall).toBe(true);
    expect(riskResult({ ...long, experience: 'little' }).startSmall).toBe(true);
    expect(riskResult({ ...long, experience: 'yes' }).startSmall).toBe(false);
    expect(riskResult({ horizon: 'over-five' }).startSmall).toBe(true);
    expect(riskResult({ horizon: 'within-year', experience: 'yes' }).startSmall).toBe(false);
  });
});

describe('where to hold the investments', () => {
  it('a Roth IRA only with earned income and more than 5 years', () => {
    expect(riskResult({ horizon: 'over-five' }, { earnedIncome: true }).where).toBe('roth-ira');
  });

  it('3 to 5 years gets a regular investment account, even with earned income', () => {
    expect(riskResult({ horizon: 'three-to-five' }, { earnedIncome: true }).where).toBe('investment-account');
  });

  it('no earned income gets a regular investment account, whatever the horizon', () => {
    expect(riskResult({ horizon: 'over-five' }, { earnedIncome: false }).where).toBe('investment-account');
    expect(riskResult({ horizon: 'three-to-five' }, { earnedIncome: false }).where).toBe('investment-account');
  });

  it('an unknown horizon is not "more than 5 years", so never a Roth IRA', () => {
    expect(riskResult({}, { earnedIncome: true }).where).toBe('investment-account');
  });

  it('unknown earned income never produces a Roth IRA, and suggests no account either way', () => {
    expect(riskResult({ horizon: 'over-five' }).where).toBeNull();
    expect(riskResult({ horizon: 'over-five' }, {}).where).toBeNull();
    expect(riskResult({ horizon: 'three-to-five' }).where).toBeNull();
  });

  it('is not suggested when the money should stay in savings', () => {
    expect(riskResult({ horizon: 'within-year' }, { earnedIncome: true }).where).toBeNull();
  });
});

describe('riskRecord', () => {
  it('bundles the status, a copy of the answers and the result for the profile', () => {
    const answers: RiskAnswers = { horizon: 'over-five', drop: 'add-more', priority: 'growth' };
    const record = riskRecord(answers, { earnedIncome: true });
    expect(record).toEqual({
      status: 'partial',
      answers,
      result: { keepSavings: false, approach: 'growth', loaf: 'index-funds', where: 'roth-ira', startSmall: true },
    });
    expect(record.answers).not.toBe(answers);
  });

  it('a skipped quiz is a record with no answers and the cautious result', () => {
    expect(riskRecord({})).toEqual({
      status: 'skipped',
      answers: {},
      result: { keepSavings: false, approach: 'steady', loaf: 'bonds', where: null, startSmall: true },
    });
  });
});
