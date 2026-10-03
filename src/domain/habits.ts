const FIVE_DOLLARS = 500;
const SEMESTER_WEEKS = 12;

export const PAYCHECK_PERCENT = 10;

export interface HabitSuggestions {
  weeklyCents: number;
  paycheckPercent: number;
}

/** Target over about one semester (12 weeks), rounded up to the nearest $5, at least $5. */
export function suggestWeeklyCents(targetCents: number): number {
  const perWeek = Math.ceil(targetCents / SEMESTER_WEEKS / FIVE_DOLLARS) * FIVE_DOLLARS;
  return Math.max(FIVE_DOLLARS, perWeek);
}

export function suggestPerPaycheckCents(paycheckCents: number): number {
  return Math.round((paycheckCents * PAYCHECK_PERCENT) / 100);
}

/** Both are offered. Placement doesn't ask income type, so the student chooses. */
export function suggestHabits(targetCents: number): HabitSuggestions {
  return { weeklyCents: suggestWeeklyCents(targetCents), paycheckPercent: PAYCHECK_PERCENT };
}
