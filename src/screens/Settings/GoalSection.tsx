import { useState } from 'react';
import { useData } from '../../app/DataProvider';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { LoafButton } from '../../components/LoafButton';
import { getSettings } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { targetForMonths } from '../../domain/targets';
import type { TargetMonths } from '../../domain/targets';
import { MAX_ENTRY_CENTS, checkAmount } from '../../money/amounts';
import { formatCents } from '../../money/format';
import { changeGoal, statusFor } from '../../money/ledger';
import { parseDollarsToCents } from '../../money/parse';
import { FLOW_LOAF } from '../useLessonFlow';

const MONTHS: readonly TargetMonths[] = [1, 3, 6];

/** Settings, "Change your goal": 1, 3 or 6 months of essentials, or a typed amount. The rules live in `changeGoal`. */
export function GoalSection() {
  const { adapter, data, refresh } = useData();
  const copy = getSettings().goal;
  const [months, setMonths] = useState<TargetMonths | null>(null);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null);

  const loaf = data?.loaves.find((l) => l.loafId === FLOW_LOAF);
  if (!data || !loaf) return null;
  const status = statusFor(data, loaf);
  const essentials = data.profile?.essentialsCents ?? null;

  // A typed amount wins over a month choice; picking a month clears the typed amount.
  const typedCents = typed.trim() === '' ? null : parseDollarsToCents(typed);
  const typedUsable = typedCents !== null && checkAmount(typedCents, MAX_ENTRY_CENTS) === null;
  let chosenCents: number | null = null;
  if (typed.trim() !== '') chosenCents = typedUsable ? typedCents : null;
  else if (months !== null && essentials !== null) chosenCents = targetForMonths(essentials, months);

  async function save() {
    if (chosenCents === null) {
      setMessage({ text: copy.invalid, kind: 'error' });
      return;
    }
    const result = await changeGoal(adapter, FLOW_LOAF, chosenCents);
    if (!result.ok) {
      setMessage({ text: result.message, kind: 'error' });
      return;
    }
    const template = result.baked ? copy.baked : result.status.growing ? copy.growing : copy.edited;
    setMessage({ text: fillTemplate(template, { goal: formatCents(result.status.targetCents) }), kind: 'ok' });
    setMonths(null);
    setTyped('');
    await refresh();
  }

  return (
    <section className="settings__section" aria-labelledby="settings-goal">
      <h2 id="settings-goal" className="settings__heading">
        {copy.title}
      </h2>
      <p className="settings__text">{fillTemplate(copy.current, { goal: formatCents(status.targetCents) })}</p>
      <p className="settings__text">{copy.intro}</p>
      {essentials !== null ? (
        <ChoiceGroup
          legend={copy.monthsLegend}
          kind="single"
          name="goal-months"
          options={MONTHS.map((m) => {
            const amount = formatCents(targetForMonths(essentials, m));
            return { id: String(m), label: m === 1 ? fillTemplate(copy.month, { amount }) : fillTemplate(copy.months, { count: String(m), amount }) };
          })}
          value={months !== null && typed.trim() === '' ? [String(months)] : []}
          onChange={(id) => {
            setMonths(Number(id) as TargetMonths);
            setTyped('');
            setMessage(null);
          }}
        />
      ) : (
        <p className="settings__text">{copy.noEssentials}</p>
      )}
      <div className="field">
        <label htmlFor="goal-custom">{copy.customLabel}</label>
        <input
          id="goal-custom"
          inputMode="decimal"
          value={typed}
          onChange={(e) => {
            setTyped(e.target.value);
            setMessage(null);
          }}
        />
      </div>
      {message && (
        <p className={message.kind === 'error' ? 'field-error' : 'notice'} role={message.kind === 'error' ? 'alert' : 'status'}>
          {message.text}
        </p>
      )}
      <LoafButton onClick={() => void save()} disabled={chosenCents === null}>
        {copy.save}
      </LoafButton>
    </section>
  );
}
