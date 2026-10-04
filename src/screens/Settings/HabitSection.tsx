import { useState } from 'react';
import { useData } from '../../app/DataProvider';
import { HabitForm } from '../../components/HabitForm';
import { getLoaf, getSettings } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { restartsStreak, saveHabit } from '../../data/habit';
import type { HabitInput } from '../../data/habit';
import type { Habit } from '../../domain/habits';
import { formatCents } from '../../money/format';
import { FLOW_LOAF } from '../useLessonFlow';

/**
 * Settings, "Change your habit". A new amount never touches the streak; only a different period length restarts it
 * (the rule is `startFor` in `src/data/habit.ts`), and the form says so before the student saves.
 */
export function HabitSection() {
  const { adapter, data, refresh } = useData();
  const copy = getSettings().habit;
  const [saved, setSaved] = useState<string | null>(null);
  // Saving remounts the form with the stored values, so what it shows is always what is saved.
  const [version, setVersion] = useState(0);

  const loaf = getLoaf(FLOW_LOAF);
  if (!data?.habit || loaf.status !== 'built') return null;
  const habit = data.habit;
  const habitCopy = loaf.flow.savingSetup.habit;
  const target = data.loaves.find((l) => l.loafId === FLOW_LOAF)?.targetCents ?? 0;

  async function onSubmit(input: HabitInput) {
    const restart = restartsStreak(habit, input);
    await saveHabit(adapter, input);
    setSaved(restart ? copy.savedRestart : copy.saved);
    setVersion((v) => v + 1);
    await refresh();
  }

  return (
    <section className="settings__section" aria-labelledby="settings-habit">
      <h2 id="settings-habit" className="settings__heading">
        {copy.title}
      </h2>
      <p className="settings__text">{fillTemplate(copy.current, { summary: summary(habit, habitCopy.frequencies, copy) })}</p>
      <HabitForm
        key={version}
        copy={habitCopy}
        targetCents={target}
        initial={habit}
        submitLabel={copy.save}
        onSubmit={onSubmit}
        restartNote={copy.restartNote}
      />
      {saved && (
        <p className="notice" role="status">
          {saved}
        </p>
      )}
    </section>
  );
}

function summary(habit: Habit, frequencies: Record<string, string>, copy: { weekly: string; paycheck: string }): string {
  const amount = formatCents(habit.amountCents);
  if (habit.kind === 'weekly') return fillTemplate(copy.weekly, { amount });
  return fillTemplate(copy.paycheck, { amount, frequency: (frequencies[habit.frequency ?? 'varies'] ?? '').toLowerCase() });
}
