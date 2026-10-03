import { creditedSavings, essentialsFigure, savingsMeetTarget, targetForMonths } from './targets';
import type { TargetMonths } from './targets';
import { progressPercent, stageForPercent } from './stages';
import { recommendNext } from './recommendations';
import type { NextLoaf } from './recommendations';
import type { AccountType, CardDebt, Stage } from './types';

export interface PlacementAnswers {
  essentials: string;
  essentialsExactCents?: number;
  savings: string;
  savingsExactCents?: number;
  accounts: readonly AccountType[];
  cardDebt: CardDebt;
  earnedIncome: boolean;
}

export interface StartingPoint {
  /** Internal only. Never shown as a label. */
  monthsCovered: number;
  essentialsCents: number;
  needsExactInput: boolean;
  isEstimate: boolean;
  /** Existing savings credited at the band's lower bound (or the exact amount). */
  existingSavingsCents: number;
  /** The emergency fund loaf is the first loaf only when it isn't already baked. */
  firstLoaf: 'emergency-fund' | null;
  targetMonths: TargetMonths | null;
  targetCents: number | null;
  /** 1 to under 3 months: existing savings are counted so the loaf starts partly risen. */
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

export function startingPoint(answers: PlacementAnswers): StartingPoint {
  const essentials = essentialsFigure(answers.essentials, answers.essentialsExactCents);
  const savings = creditedSavings(answers.savings, answers.savingsExactCents);
  const covered = monthsCovered(savings, essentials.cents);

  // Compare in cents so band edges never hit float error.
  const underOne = savings < essentials.cents;
  const underThree = savings < essentials.cents * 3;
  const hasDebt = answers.cardDebt === 'yes';

  const baked = !underOne && (!underThree || hasDebt);
  const targetMonths: TargetMonths | null = baked ? null : underOne ? 1 : 3;
  const targetCents = targetMonths ? targetForMonths(essentials.cents, targetMonths) : null;
  const countSavingsByDefault = !baked && !underOne;
  const startPercent =
    targetCents && countSavingsByDefault ? progressPercent(savings, targetCents) : 0;

  const accounts = answers.accounts;
  const hasHighYield = accounts.includes('high-yield-savings');
  const hasAnySavings = hasHighYield || accounts.includes('regular-savings');

  return {
    monthsCovered: covered,
    essentialsCents: essentials.cents,
    needsExactInput: essentials.needsExactInput,
    isEstimate: essentials.isEstimate,
    existingSavingsCents: savings,
    firstLoaf: baked ? null : 'emergency-fund',
    targetMonths,
    targetCents,
    countSavingsByDefault,
    startPercent,
    startStage: stageForPercent(startPercent),
    suggestBiggerTarget: targetCents !== null && savingsMeetTarget(savings, targetCents),
    emergencyFundBaked: baked,
    nextLoaf: baked ? recommendNext(answers) : null,
    needsHysaStep: !hasAnySavings,
    whereToKeepOptional: hasHighYield,
    showInvestmentNote: !baked && accounts.includes('investment'),
  };
}
