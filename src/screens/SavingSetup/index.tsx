import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { DraftNote } from '../../components/DraftNote';
import { HysaPoints } from '../../components/HysaPoints';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { getLoaf } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { saveDefaultHabit, saveHabit, setHysaCard } from '../../data/habit';
import { addHighYieldAccount } from '../../data/profile';
import { accountRules } from '../../domain/placement';
import { PAYCHECK_PERCENT, PAY_FREQUENCIES, suggestPerPaycheckCents, suggestWeeklyCents } from '../../domain/habits';
import type { PayFrequency } from '../../domain/habits';
import { MAX_ENTRY_CENTS, checkAmount } from '../../money/amounts';
import { formatCents } from '../../money/format';
import { centsToInput, parseDollarsToCents } from '../../money/parse';
import { FLOW_LOAF } from '../useLessonFlow';

type Step = 'hysa' | 'habit' | 'automatic';
type Kind = 'weekly' | 'paycheck';

/** A usable dollar amount in cents, or null (empty, not a dollar amount, or over the one-entry limit). */
function usableCents(text: string): number | null {
  const cents = parseDollarsToCents(text);
  return cents !== null && checkAmount(cents, MAX_ENTRY_CENTS) === null ? cents : null;
}

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

  const [kind, setKind] = useState<Kind>('weekly');
  const targetCents = data?.loaves.find((l) => l.loafId === FLOW_LOAF)?.targetCents ?? 0;
  const suggestedWeekly = suggestWeeklyCents(targetCents);
  const [weeklyText, setWeeklyText] = useState(centsToInput(suggestedWeekly));
  const [frequency, setFrequency] = useState<PayFrequency | null>(null);
  const [paycheckText, setPaycheckText] = useState('');
  const [paycheckAmountEdit, setPaycheckAmountEdit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!data) return null;
  const step = steps[stepIndex];
  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const percent = `${PAYCHECK_PERCENT}%`;

  const paycheckCents = usableCents(paycheckText);
  const suggestedPerPaycheck = paycheckCents === null ? null : suggestPerPaycheckCents(paycheckCents);
  const paycheckAmountText = paycheckAmountEdit ?? (suggestedPerPaycheck ? centsToInput(suggestedPerPaycheck) : '');

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

  const weeklyCents = usableCents(weeklyText);
  const perPaycheckCents = usableCents(paycheckAmountText);
  const canContinue = kind === 'weekly' ? weeklyCents !== null : paycheckCents !== null && perPaycheckCents !== null && frequency !== null;

  async function continueHabit() {
    if (kind === 'weekly' && weeklyCents !== null) {
      await saveHabit(adapter, { kind: 'weekly', amountCents: weeklyCents });
    } else if (kind === 'paycheck' && paycheckCents !== null && perPaycheckCents !== null && frequency !== null) {
      await saveHabit(adapter, { kind: 'paycheck', amountCents: perPaycheckCents, paycheckCents, frequency });
    } else {
      setError(copy.habit.invalid);
      return;
    }
    setError(null);
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
        <ChoiceGroup
          legend={h.intro}
          kind="single"
          name="habit-kind"
          options={[
            { id: 'weekly', label: h.weeklyTitle },
            { id: 'paycheck', label: h.paycheckTitle },
          ]}
          value={[kind]}
          onChange={(id) => {
            setKind(id as Kind);
            setError(null);
          }}
        />

        {kind === 'weekly' ? (
          <div className="field">
            <p>{fillTemplate(h.weeklyBody, { amount: formatCents(suggestedWeekly) })}</p>
            <label htmlFor="habit-weekly">{h.weeklyLabel}</label>
            <input id="habit-weekly" inputMode="decimal" value={weeklyText} onChange={(e) => setWeeklyText(e.target.value)} />
          </div>
        ) : (
          <>
            <p>{fillTemplate(h.paycheckBody, { percent })}</p>
            <ChoiceGroup
              legend={h.frequencyLabel}
              kind="single"
              name="pay-frequency"
              options={PAY_FREQUENCIES.map((f) => ({ id: f, label: h.frequencies[f] }))}
              value={frequency ? [frequency] : []}
              onChange={(id) => setFrequency(id as PayFrequency)}
            />
            <div className="field">
              <label htmlFor="habit-paycheck">{h.paycheckLabel}</label>
              <input id="habit-paycheck" inputMode="decimal" value={paycheckText} onChange={(e) => { setPaycheckText(e.target.value); setPaycheckAmountEdit(null); }} />
            </div>
            {paycheckCents !== null && (
              <div className="field">
                <p>{fillTemplate(h.paycheckNote, { percent, paycheck: formatCents(paycheckCents) })}</p>
                <label htmlFor="habit-paycheck-amount">{h.paycheckAmountLabel}</label>
                <input id="habit-paycheck-amount" inputMode="decimal" value={paycheckAmountText} onChange={(e) => setPaycheckAmountEdit(e.target.value)} />
              </div>
            )}
          </>
        )}

        <p className="choice-group__help">{h.accountNote}</p>
        {error && <p className="field-error" role="alert">{error}</p>}

        <div className="new-loaf__actions">
          <LoafButton onClick={() => void continueHabit()} disabled={!canContinue}>
            {h.continue}
          </LoafButton>
          <SliceButton onClick={() => void skipHabit()}>{h.skip}</SliceButton>
        </div>
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
