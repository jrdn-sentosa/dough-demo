import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { HabitForm } from '../../components/HabitForm';
import { HysaPoints } from '../../components/HysaPoints';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf } from '../../content/loader';
import { saveDefaultHabit, saveHabit, setHysaCard } from '../../data/habit';
import type { HabitInput } from '../../data/habit';
import { addHighYieldAccount } from '../../data/profile';
import { accountRules } from '../../domain/placement';
import { FLOW_LOAF } from '../useLessonFlow';

type Step = 'hysa' | 'habit' | 'automatic';

/**
 * Saving setup: a high-yield account step (only when the account rules say so; never blocks),
 * the habit, then a "Make it automatic" suggestion that leads to Home.
 */
export function SavingSetup() {
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('saving setup needs a built loaf');
  const copy = loaf.flow.savingSetup;
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();

  // The step list is fixed when the screen opens, so "I have one now" doesn't pull the step out from under the student.
  const [steps] = useState<Step[]>(() =>
    accountRules(data?.profile?.accounts ?? undefined).needsHysaStep ? ['hysa', 'habit', 'automatic'] : ['habit', 'automatic'],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [skipped, setSkipped] = useState(false);

  const targetCents = data?.loaves.find((l) => l.loafId === FLOW_LOAF)?.targetCents ?? 0;

  if (!data) return null;
  const step = steps[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));

  async function haveOne() {
    await addHighYieldAccount(adapter);
    await refresh();
    next();
  }

  async function later() {
    await setHysaCard(adapter, 'pending');
    await refresh();
    next();
  }

  async function continueHabit(input: HabitInput) {
    await saveHabit(adapter, input);
    await refresh();
    next();
  }

  async function skipHabit() {
    await saveDefaultHabit(adapter, FLOW_LOAF);
    setSkipped(true);
    await refresh();
    next();
  }

  if (step === 'hysa') {
    return (
      <div className="new-loaf">
        <h1 className="screen-title">{copy.hysa.title}</h1>
        <DraftNote draft={loaf.draft} />
        <HysaPoints intro={copy.hysa.intro} points={copy.hysa.points} demoNote={copy.hysa.demoNote} />
        <div className="new-loaf__actions">
          <LoafButton onClick={() => void haveOne()}>{copy.hysa.haveOne}</LoafButton>
          <SliceButton onClick={() => void later()}>{copy.hysa.later}</SliceButton>
        </div>
      </div>
    );
  }

  if (step === 'habit') {
    const h = copy.habit;
    return (
      <div className="new-loaf">
        <h1 className="screen-title">{h.title}</h1>
        <DraftNote draft={loaf.draft} />
        <HabitForm
          copy={h}
          targetCents={targetCents}
          initial={null}
          submitLabel={h.continue}
          onSubmit={continueHabit}
          extra={<SliceButton onClick={() => void skipHabit()}>{h.skip}</SliceButton>}
        />
      </div>
    );
  }

  return (
    <div className="new-loaf">
      <h1 className="screen-title">{copy.automatic.title}</h1>
      <DraftNote draft={loaf.draft} />
      <p>{copy.automatic.body}</p>
      {skipped && <p className="notice">{copy.automatic.skippedNote}</p>}
      <div className="new-loaf__actions">
        <LoafButton onClick={() => navigate('/', { replace: true })}>{copy.automatic.done}</LoafButton>
      </div>
    </div>
  );
}
