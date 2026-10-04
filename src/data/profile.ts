import type { PlacementAnswers } from '../domain/placement';
import { answersFromProfile, profileFromAnswers } from '../domain/profile';
import type { Profile } from '../domain/profile';
import { retake } from '../domain/retake';
import { riskRecord } from '../domain/risk';
import type { RiskAnswers, RiskRecord } from '../domain/risk';
import type { RetakeResult } from '../domain/retake';
import type { LoafId } from '../domain/types';
import type { DataAdapter } from './adapter';

export async function loadProfile(adapter: DataAdapter): Promise<Profile | null> {
  return (await adapter.load()).profile;
}

/**
 * Stores what placement collected, including a skipped or partly answered one.
 * Only the profile changes: loaves and transactions are left exactly as they are.
 */
export async function savePlacement(adapter: DataAdapter, answers: PlacementAnswers): Promise<Profile> {
  const data = await adapter.load();
  data.profile = { ...profileFromAnswers(answers), risk: data.profile?.risk ?? null };
  await adapter.save(data);
  return data.profile;
}

/**
 * "I have one now" (Saving setup or the Home reminder): adds high-yield savings to the profile's
 * accounts, so a retake shows it selected and no later loaf asks about it. "None" and "Not sure"
 * are dropped, the same way picking a real account does in placement. Only the profile changes
 * (and the Home reminder is cleared); the placement status, targets and transactions stay as they were.
 * Does nothing without a profile.
 */
export async function addHighYieldAccount(adapter: DataAdapter): Promise<Profile | null> {
  const data = await adapter.load();
  if (!data.profile) return null;
  const real = (data.profile.accounts ?? []).filter((a) => a !== 'none' && a !== 'not-sure');
  if (!real.includes('high-yield-savings')) real.push('high-yield-savings');
  data.profile = { ...data.profile, accounts: real };
  data.hysaCard = null;
  await adapter.save(data);
  return data.profile;
}

/**
 * Saves the risk quiz (answered, partly answered or skipped) on the profile, with its result.
 * Earned income comes from placement: unknown earned income never produces a Roth IRA suggestion.
 * Null without a profile.
 */
export async function saveRisk(adapter: DataAdapter, answers: RiskAnswers): Promise<RiskRecord | null> {
  const data = await adapter.load();
  if (!data.profile) return null;
  const earnedIncome = data.profile.earnedIncome ?? undefined;
  const record = riskRecord(answers, earnedIncome === undefined ? {} : { earnedIncome });
  data.profile = { ...data.profile, risk: record };
  await adapter.save(data);
  return record;
}

/**
 * "To size your 3-month goal, about how much do you need each month?": a student whose essentials
 * were unknown gives a figure so the shelf and later goals can work out months. Only the profile changes.
 */
export async function saveEssentials(adapter: DataAdapter, essentialsCents: number): Promise<Profile | null> {
  const data = await adapter.load();
  if (!data.profile) return null;
  data.profile = { ...data.profile, essentialsExactCents: essentialsCents, essentialsCents };
  await adapter.save(data);
  return data.profile;
}

/**
 * Settings, "Retake the quiz": prefill with `answersFromProfile`, then pass the
 * new answers here. Updates the profile only. It never deletes or changes
 * transactions, and never changes the goal: the result's `suggestedTargetCents`
 * is for asking "Update your goal to {amount}?".
 */
export async function retakePlacement(
  adapter: DataAdapter,
  next: PlacementAnswers,
  loafId: LoafId = 'emergency-fund',
): Promise<RetakeResult> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  const result = retake({
    current: data.profile ? answersFromProfile(data.profile) : {},
    next,
    loaf: loaf
      ? { targetCents: loaf.targetCents, hasTransactions: data.transactions.some((t) => t.loafId === loafId) }
      : null,
  });
  // Retaking placement never clears the risk quiz result.
  data.profile = { ...result.profile, risk: data.profile?.risk ?? null };
  await adapter.save(data);
  return { ...result, profile: data.profile };
}
