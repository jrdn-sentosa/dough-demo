import { DEFAULT_GOAL_CENTS } from './bands';
import { creditedSavings, essentialsFigure, savingsMeetTarget, targetForMonths } from './targets';
import type { EssentialsFigure, TargetMonths } from './targets';
import { progressPercent, stageForPercent } from './stages';
import { recommendNext } from './recommendations';
import type { NextLoaf } from './recommendations';
import type { AccountType, CardDebt, Stage } from './types';

/** Every answer is optional: a skipped or unanswered question is unknown. */
export interface PlacementAnswers {
  essentials?: string;
  essentialsExactCents?: number;
  savings?: string;
  savingsExactCents?: number;
  accounts?: readonly AccountType[];
  cardDebt?: CardDebt;
  earnedIncome?: boolean;
}

export interface StartingPoint {
  /**
   * Internal only. Never shown as a label. Null when essentials are unknown:
   * it is not computed from the starter goal.
   */
  monthsCovered: number | null;
  /** Null when essentials are unknown. */
  essentialsCents: number | null;
  needsExactInput: boolean;
  /**
   * Essentials are unknown, so the goal is the starter goal (`DEFAULT_GOAL_CENTS`),
   * not an estimate of the student's essentials. The student can change it in Settings.
   */
  isDefault: boolean;
  /** Existing savings credited at the band's lower bound (or the exact amount). */
  existingSavingsCents: number;
  /** The emergency fund loaf is the first loaf only when it isn't already baked. */
  firstLoaf: 'emergency-fund' | null;
  /** Null when baked, or when essentials are unknown (`isDefault`). */
  targetMonths: TargetMonths | null;
  targetCents: number | null;
  /** Existing savings are counted so the loaf starts partly risen. */
  countSavingsByDefault: boolean;
  startPercent: number;
  startStage: Stage;
  /** Savings already meet the chosen target: suggest a bigger one. */
  suggestBiggerTarget: boolean;
  /** Counted as baked and put on the shelf as "Already built". */
  emergencyFundBaked: boolean;
  /** Set when the emergency fund is already baked. */
  nextLoaf: NextLoaf | null;
  needsHysaStep: boolean;
  whereToKeepOptional: boolean;
  showInvestmentNote: boolean;
}

/** Existing savings divided by monthly essentials. */
export function monthsCovered(savingsCents: number, essentialsCents: number): number {
  return essentialsCents > 0 ? savingsCents / essentialsCents : 0;
}

/**
 * Unknown accounts (skipped) get the high-yield step, and `ef-where-to-keep`
 * stays required (recommended). Only a high-yield account makes it optional.
 */
export function accountRules(accounts?: readonly AccountType[]): {
  needsHysaStep: boolean;
  whereToKeepOptional: boolean;
} {
  const hasHighYield = accounts?.includes('high-yield-savings') ?? false;
  const hasAnySavings = hasHighYield || (accounts?.includes('regular-savings') ?? false);
  return { needsHysaStep: !hasAnySavings, whereToKeepOptional: hasHighYield };
}

export function startingPoint(answers: PlacementAnswers): StartingPoint {
  const essentials: EssentialsFigure =
    answers.essentials === undefined
      ? { cents: null, needsExactInput: false }
      : essentialsFigure(answers.essentials, answers.essentialsExactCents);
  // Unanswered savings: none, so the loaf starts as a dough ball.
  const savings =
    answers.savings === undefined ? 0 : creditedSavings(answers.savings, answers.savingsExactCents);
  const rules = accountRules(answers.accounts);
  const hasInvestments = answers.accounts?.includes('investment') ?? false;

  if (essentials.cents === null) {
    // Essentials unknown: start the fund at the starter goal and count savings toward it.
    // Months are not worked out, so nothing here depends on a guessed essentials figure.
    const baked = savings >= DEFAULT_GOAL_CENTS;
    const targetCents = baked ? null : DEFAULT_GOAL_CENTS;
    const countSavingsByDefault = !baked && savings > 0;
    const startPercent = targetCents && countSavingsByDefault ? progressPercent(savings, targetCents) : 0;
    return {
      monthsCovered: null,
      essentialsCents: null,
      needsExactInput: false,
      isDefault: true,
      existingSavingsCents: savings,
      firstLoaf: baked ? null : 'emergency-fund',
      targetMonths: null,
      targetCents,
      countSavingsByDefault,
      startPercent,
      startStage: stageForPercent(startPercent),
      suggestBiggerTarget: false,
      emergencyFundBaked: baked,
      nextLoaf: baked ? recommendNext({ ...answers, targetIsDefault: true }) : null,
      ...rules,
      showInvestmentNote: !baked && hasInvestments,
    };
  }

  const covered = monthsCovered(savings, essentials.cents);

  // Compare in cents so band edges never hit float error.
  const underOne = savings < essentials.cents;
  const underThree = savings < essentials.cents * 3;
  const hasDebt = answers.cardDebt === 'yes';

  const baked = !underOne && (!underThree || hasDebt);
  const targetMonths: TargetMonths | null = baked ? null : underOne ? 1 : 3;
  const targetCents = targetMonths ? targetForMonths(essentials.cents, targetMonths) : null;
  // Any reported savings count by default, whatever the months covered. The student can uncheck it.
  const countSavingsByDefault = !baked && savings > 0;
  const startPercent =
    targetCents && countSavingsByDefault ? progressPercent(savings, targetCents) : 0;

  return {
    monthsCovered: covered,
    essentialsCents: essentials.cents,
    needsExactInput: essentials.needsExactInput,
    isDefault: false,
    existingSavingsCents: savings,
    firstLoaf: baked ? null : 'emergency-fund',
    targetMonths,
    targetCents,
    countSavingsByDefault,
    startPercent,
    startStage: stageForPercent(startPercent),
    suggestBiggerTarget: targetCents !== null && savingsMeetTarget(savings, targetCents),
    emergencyFundBaked: baked,
    // The "Already built" bake is recorded at the biggest of 1 or 3 months the savings cover (see `bakedStartTargetCents`).
    nextLoaf: baked ? recommendNext({ ...answers, targetMonths: covered >= 3 ? 3 : 1 }) : null,
    ...rules,
    showInvestmentNote: !baked && hasInvestments,
  };
}
