import type { PlacementAnswers } from '../domain/placement';
import { answersFromProfile, profileFromAnswers } from '../domain/profile';
import type { Profile } from '../domain/profile';
import { retake } from '../domain/retake';
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
  data.profile = profileFromAnswers(answers);
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
  data.profile = result.profile;
  await adapter.save(data);
  return result;
}
