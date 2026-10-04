import type { LoafRecord } from '../../data/types';
import type { Profile } from '../../domain/profile';
import { recommendNext } from '../../domain/recommendations';
import type { NextLoaf } from '../../domain/recommendations';
import { monthsForTarget } from '../../domain/targets';

/**
 * What "Choose your next loaf" recommends, from the profile and the loaf that just baked.
 * The target that baked is the latest bake's target. Unknown essentials mean the target was the
 * starter goal (or a custom amount) with no months figure, so Keep saving asks for essentials first.
 */
export function nextForLoaf(profile: Profile | null, loaf: LoafRecord): NextLoaf {
  const essentials = profile?.essentialsCents ?? null;
  const baked = loaf.bakes[loaf.bakes.length - 1]?.targetCents ?? loaf.targetCents;
  return recommendNext({
    cardDebt: profile?.cardDebt ?? undefined,
    earnedIncome: profile?.earnedIncome ?? undefined,
    accounts: profile?.accounts ?? undefined,
    targetMonths: essentials === null ? null : monthsForTarget(baked, essentials),
    targetIsDefault: essentials === null,
  });
}
