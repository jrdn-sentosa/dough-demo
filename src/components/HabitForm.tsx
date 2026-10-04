import { useState } from 'react';
import type { ReactNode } from 'react';
import type { SavingSetupContent } from '../content/types';
import { fillTemplate } from '../content/template';
import { restartsStreak } from '../data/habit';
import type { HabitInput } from '../data/habit';
import { PAYCHECK_PERCENT, PAY_FREQUENCIES, suggestPerPaycheckCents, suggestWeeklyCents } from '../domain/habits';
import type { Habit, PayFrequency } from '../domain/habits';
import { MAX_ENTRY_CENTS, checkAmount } from '../money/amounts';
import { formatCents } from '../money/format';
import { centsToInput, parseDollarsToCents } from '../money/parse';
import { ChoiceGroup } from './ChoiceGroup';
import { LoafButton } from './LoafButton';

type Kind = 'weekly' | 'paycheck';

/** A usable dollar amount in cents, or null (empty, not a dollar amount, or over the one-entry limit). */
function usableCents(text: string): number | null {
  const cents = parseDollarsToCents(text);
  return cents !== null && checkAmount(cents, MAX_ENTRY_CENTS) === null ? cents : null;
}

interface HabitFormProps {
  copy: SavingSetupContent['habit'];
  /** The loaf's goal, for the suggested weekly amount. */
  targetCents: number;
  /** The habit being edited (Settings). Null in Saving setup, where the form starts from the suggestion. */
  initial: Habit | null;
  submitLabel: string;
  onSubmit: (input: HabitInput) => void | Promise<void>;
  /** A secondary action under the main button, such as "Skip for now". */
  extra?: ReactNode;
  /** Shown while the typed habit would restart the streak (a different period length than `initial`). */
  restartNote?: string;
}

/**
 * The habit fields shared by Saving setup and Settings: weekly or 10% of each paycheck, with the pay
 * frequency, and the amount editable. Saving goes through `onSubmit`; the amount rules are checked here.
 */
export function HabitForm({ copy: h, targetCents, initial, submitLabel, onSubmit, extra, restartNote }: HabitFormProps) {
  const suggestedWeekly = suggestWeeklyCents(targetCents);
  const [kind, setKind] = useState<Kind>(initial?.kind ?? 'weekly');
  const [weeklyText, setWeeklyText] = useState(centsToInput(initial?.kind === 'weekly' ? initial.amountCents : suggestedWeekly));
  const [frequency, setFrequency] = useState<PayFrequency | null>(initial?.frequency ?? null);
  const [paycheckText, setPaycheckText] = useState(initial?.paycheckCents ? centsToInput(initial.paycheckCents) : '');
  const [paycheckAmountEdit, setPaycheckAmountEdit] = useState<string | null>(
    initial?.kind === 'paycheck' ? centsToInput(initial.amountCents) : null,
  );
  const [error, setError] = useState<string | null>(null);
  const percent = `${PAYCHECK_PERCENT}%`;

  const paycheckCents = usableCents(paycheckText);
  const suggestedPerPaycheck = paycheckCents === null ? null : suggestPerPaycheckCents(paycheckCents);
  const paycheckAmountText = paycheckAmountEdit ?? (suggestedPerPaycheck ? centsToInput(suggestedPerPaycheck) : '');
  const weeklyCents = usableCents(weeklyText);
  const perPaycheckCents = usableCents(paycheckAmountText);
  const canContinue = kind === 'weekly' ? weeklyCents !== null : paycheckCents !== null && perPaycheckCents !== null && frequency !== null;

  const input: HabitInput | null =
    kind === 'weekly' && weeklyCents !== null
      ? { kind: 'weekly', amountCents: weeklyCents }
      : kind === 'paycheck' && paycheckCents !== null && perPaycheckCents !== null && frequency !== null
        ? { kind: 'paycheck', amountCents: perPaycheckCents, paycheckCents, frequency }
        : null;
  const restarts = restartNote !== undefined && input !== null && restartsStreak(initial, input);

  async function submit() {
    if (!input) {
      setError(h.invalid);
      return;
    }
    setError(null);
    await onSubmit(input);
  }

  return (
    <>
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
            <input
              id="habit-paycheck"
              inputMode="decimal"
              value={paycheckText}
              onChange={(e) => {
                setPaycheckText(e.target.value);
                setPaycheckAmountEdit(null);
              }}
            />
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
      {restarts && <p className="notice">{restartNote}</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}

      <div className="new-loaf__actions">
        <LoafButton onClick={() => void submit()} disabled={!canContinue}>
          {submitLabel}
        </LoafButton>
        {extra}
      </div>
    </>
  );
}
