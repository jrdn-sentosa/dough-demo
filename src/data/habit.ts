import { defaultHabit } from '../domain/habits';
import type { Habit, PayFrequency } from '../domain/habits';
import { nowIso } from '../money/clock';
import type { DataAdapter } from './adapter';
import type { HysaCardState } from './types';

export type HabitInput =
  | { kind: 'weekly'; amountCents: number }
  | { kind: 'paycheck'; amountCents: number; paycheckCents: number; frequency: PayFrequency };

/** Saves the habit from Saving setup. The start date comes from the demo clock; periods are counted from it. */
export async function saveHabit(adapter: DataAdapter, input: HabitInput): Promise<Habit> {
  const data = await adapter.load();
  const startedAt = await nowIso(adapter);
  data.habit =
    input.kind === 'weekly'
      ? { kind: 'weekly', amountCents: input.amountCents, paycheckCents: null, frequency: null, startedAt }
      : { kind: 'paycheck', amountCents: input.amountCents, paycheckCents: input.paycheckCents, frequency: input.frequency, startedAt };
  await adapter.save(data);
  return data.habit;
}

/** "Skip for now" on the habit step: the suggested weekly amount for the loaf's target. Null if there is no loaf. */
export async function saveDefaultHabit(adapter: DataAdapter, loafId = 'emergency-fund'): Promise<Habit | null> {
  const data = await adapter.load();
  const loaf = data.loaves.find((l) => l.loafId === loafId);
  if (!loaf) return null;
  data.habit = defaultHabit(loaf.targetCents, await nowIso(adapter));
  await adapter.save(data);
  return data.habit;
}

/** Opening a tip clears its "New" badge. Opening it again changes nothing. */
export async function markTipSeen(adapter: DataAdapter, id: string): Promise<void> {
  const data = await adapter.load();
  if (data.tipsSeen.includes(id)) return;
  data.tipsSeen.push(id);
  await adapter.save(data);
}

export async function setHysaCard(adapter: DataAdapter, state: HysaCardState): Promise<void> {
  const data = await adapter.load();
  data.hysaCard = state;
  await adapter.save(data);
}
