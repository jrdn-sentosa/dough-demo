import type { HomeContent } from '../content/types';
import { fillTemplate } from '../content/template';
import type { Habit, HabitPeriod } from '../domain/habits';
import { formatCents } from '../money/format';

const shortDate = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/**
 * This period's habit: "Not logged yet" or "Logged". For "it varies" there is no period to check,
 * so the card says "Each paycheck" and when the student last added to their loaf instead.
 */
export function HabitCard({ habit, period, copy }: { habit: Habit; period: HabitPeriod; copy: HomeContent['habitCard'] }) {
  const label = copy.label[habit.kind === 'weekly' ? 'weekly' : (habit.frequency ?? 'varies')];
  const status = period.tracked
    ? period.logged
      ? copy.logged
      : copy.notLogged
    : period.lastAddedAt
      ? fillTemplate(copy.lastAdded, { date: shortDate(period.lastAddedAt) })
      : copy.neverAdded;
  return (
    <section className="habit-card" aria-label={label}>
      <div>
        <div className="habit-card__label">{label}</div>
        <div className="habit-card__value">{fillTemplate(copy.value, { amount: formatCents(habit.amountCents) })}</div>
      </div>
      <span className={`habit-card__status${period.tracked && period.logged ? ' habit-card__status--logged' : ''}`}>{status}</span>
    </section>
  );
}
