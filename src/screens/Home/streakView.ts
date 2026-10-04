import type { BreadsContent } from '../../content/types';
import { fillTemplate } from '../../content/template';
import type { BreadId } from '../../domain/breads';
import type { Habit } from '../../domain/habits';
import { breadsReached, latestUnlocked, nextUnlock, streakUnit, weeksCovered } from '../../domain/streaks';

export interface StreakView {
  /** The headline: "4-week streak", "3 pay periods", "2 months", "New streak starts now." */
  value: string;
  /** The line under it: what is unlocked and what comes next. */
  line: string;
  /** Weeks of saving, for students whose streak isn't counted in weeks. Null for weekly savers. */
  pill: string | null;
  /** The bread to show beside the card: the latest unlocked, or null. */
  latest: BreadId | null;
}

interface Input {
  habit: Habit;
  /** Current streak in periods. */
  streak: number;
  /** Breads already unlocked (permanent). */
  unlocked: readonly BreadId[];
  /** Longest streak so far, in days. Above 0 with a streak of 0 means a streak has started over. */
  bestDays: number;
  copy: BreadsContent;
}

/** The words for Home's streak card. A reset reads "New streak starts now." and never says anything was lost. */
export function streakView({ habit, streak, unlocked, bestDays, copy }: Input): StreakView {
  const c = copy.streak;
  const count = String(streak);
  const unit = streakUnit(habit);
  const startedOver = streak === 0 && bestDays > 0;

  let value: string;
  if (startedOver) value = c.resetValue;
  else if (streak === 0) value = c.valueNone;
  else if (unit === 'week') value = fillTemplate(c.valueWeek, { count });
  else if (unit === 'pay-period') value = streak === 1 ? c.valuePayPeriodOne : fillTemplate(c.valuePayPeriod, { count });
  else value = streak === 1 ? c.valueMonthOne : fillTemplate(c.valueMonth, { count });

  // Count what the streak has reached too, so the card is right even before the unlock has been saved.
  const known = [...unlocked, ...breadsReached(habit, streak)];
  const next = nextUnlock(known);
  const latest = latestUnlocked(known);
  const weeksFor = next ? String(next.weeks) : '';
  const nextName = next ? copy.names[next.bread] : '';

  let line: string;
  if (next === null) line = startedOver ? c.resetAllUnlocked : c.allUnlocked;
  else if (startedOver) line = fillTemplate(c.resetBody, { bread: nextName, weeks: weeksFor });
  else if (latest) line = fillTemplate(c.unlockedNext, { bread: copy.names[latest], next: nextName, weeks: weeksFor });
  else line = fillTemplate(c.startNext, { bread: nextName, weeks: weeksFor });

  const weeks = Math.floor(weeksCovered(habit, streak));
  const pill = unit !== 'week' && streak > 0 ? fillTemplate(c.weeksPill, { weeks: String(weeks) }) : null;
  return { value, line, pill, latest };
}
