/**
 * The risk quiz. There are no right answers: it only works out what to explain next.
 * The result is educational, never an instruction, and has no percentages or allocations.
 */

export type Horizon = 'within-year' | 'one-to-three' | 'three-to-five' | 'over-five';
export type DropReaction = 'sell-all' | 'sell-some' | 'wait' | 'add-more';
export type Priority = 'not-losing' | 'balance' | 'growth';
export type Experience = 'none' | 'little' | 'yes';

export const HORIZONS: readonly Horizon[] = ['within-year', 'one-to-three', 'three-to-five', 'over-five'];
export const DROP_REACTIONS: readonly DropReaction[] = ['sell-all', 'sell-some', 'wait', 'add-more'];
export const PRIORITIES: readonly Priority[] = ['not-losing', 'balance', 'growth'];
export const EXPERIENCES: readonly Experience[] = ['none', 'little', 'yes'];

export const RISK_QUESTION_IDS = ['horizon', 'drop', 'priority', 'experience'] as const;
export type RiskQuestionId = (typeof RISK_QUESTION_IDS)[number];

/** Every answer is optional: a skipped question is unknown. */
export interface RiskAnswers {
  horizon?: Horizon;
  drop?: DropReaction;
  priority?: Priority;
  experience?: Experience;
}

/** `complete`: all 4 answered. `partial`: skipped partway, with at least one answer kept. `skipped`: nothing answered. */
export type RiskStatus = 'complete' | 'partial' | 'skipped';

export type Approach = 'steady' | 'growth';
export type InvestingLoaf = 'bonds' | 'index-funds';
export type InvestWhere = 'roth-ira' | 'investment-account';

export interface RiskResult {
  /** The money is needed in under 3 years: keep it in savings, and offer Grow your cushion. */
  keepSavings: boolean;
  /** A steadier approach (more bonds) or a growth-focused one (index funds). Null when `keepSavings`. */
  approach: Approach | null;
  /** The investing loaf that fits (still "Coming soon" in the demo). Null when `keepSavings`. */
  loaf: InvestingLoaf | null;
  /**
   * Where the investments would be held. A Roth IRA needs earned income and long-term money (more than 5
   * years). Null when `keepSavings`, or when earned income is unknown: it never guesses a Roth IRA.
   */
  where: InvestWhere | null;
  /** Question 4 only changes the wording: say "start small while you learn". */
  startSmall: boolean;
}

/** What is saved on the profile. */
export interface RiskRecord {
  status: RiskStatus;
  answers: RiskAnswers;
  result: RiskResult;
}

/** Comfort with ups and downs, from questions 2 and 3: 0 (most cautious) to 5. */
const DROP_POINTS: Record<DropReaction, number> = { 'sell-all': 0, 'sell-some': 1, wait: 2, 'add-more': 3 };
const PRIORITY_POINTS: Record<Priority, number> = { 'not-losing': 0, balance: 1, growth: 2 };

/** Comfort at or above this leans toward growth. A 3-to-5-year (or unknown) horizon leans steadier, so it needs more. */
const GROWTH_COMFORT_LONG = 3;
const GROWTH_COMFORT_MEDIUM = 4;

export function riskStatus(answers: RiskAnswers): RiskStatus {
  const answered = [answers.horizon, answers.drop, answers.priority, answers.experience].filter((a) => a !== undefined).length;
  if (answered === 4) return 'complete';
  return answered === 0 ? 'skipped' : 'partial';
}

export function comfortScore(answers: RiskAnswers): number {
  return (answers.drop === undefined ? 0 : DROP_POINTS[answers.drop]) + (answers.priority === undefined ? 0 : PRIORITY_POINTS[answers.priority]);
}

/**
 * Skipped questions take the most cautious answer, except the horizon: an unknown horizon is never
 * treated as short (we don't push someone to savings without being told), only as "not more than 5 years".
 */
export function riskResult(answers: RiskAnswers, { earnedIncome }: { earnedIncome?: boolean } = {}): RiskResult {
  const startSmall = answers.experience !== 'yes';
  if (answers.horizon === 'within-year' || answers.horizon === 'one-to-three') {
    return { keepSavings: true, approach: null, loaf: null, where: null, startSmall };
  }
  const longTerm = answers.horizon === 'over-five';
  const growth = comfortScore(answers) >= (longTerm ? GROWTH_COMFORT_LONG : GROWTH_COMFORT_MEDIUM);
  const where: InvestWhere | null =
    earnedIncome === undefined ? null : earnedIncome && longTerm ? 'roth-ira' : 'investment-account';
  return {
    keepSavings: false,
    approach: growth ? 'growth' : 'steady',
    loaf: growth ? 'index-funds' : 'bonds',
    where,
    startSmall,
  };
}

export function riskRecord(answers: RiskAnswers, context: { earnedIncome?: boolean } = {}): RiskRecord {
  return { status: riskStatus(answers), answers: { ...answers }, result: riskResult(answers, context) };
}
