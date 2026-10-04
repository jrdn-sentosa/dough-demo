import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { DraftNote } from '../../components/DraftNote';
import { LoafButton } from '../../components/LoafButton';
import { SliceButton } from '../../components/SliceButton';
import { BreadPicker } from '../../components/BreadPicker';
import { getBreads, getPlacement } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import { savePlacement } from '../../data/profile';
import { breadChoices } from '../../data/streaks';
import { DEFAULT_BREAD } from '../../domain/breads';
import type { BreadId } from '../../domain/breads';
import { DEFAULT_GOAL_CENTS } from '../../domain/bands';
import { startingPoint } from '../../domain/placement';
import type { PlacementAnswers } from '../../domain/placement';
import { answersFromProfile } from '../../domain/profile';
import { bakedStartTargetCents } from '../../domain/placementInput';
import { creditedSavings, targetForMonths } from '../../domain/targets';
import type { TargetMonths } from '../../domain/targets';
import { formatCents } from '../../money/format';
import { createFirstLoaf } from '../../money/newLoaf';
import { centsToInput, parseDollarsToCents } from '../../money/parse';

type GoalChoice = '1' | '3' | '6' | 'default' | 'custom';
const MONTH_CHOICES: readonly TargetMonths[] = [1, 3, 6];
const monthsText = (n: number) => `${n} month${n === 1 ? '' : 's'}`;

/**
 * "Your new loaf": pick the goal, choose whether to count savings the student already has,
 * and start the loaf. A fund that is already built skips the choices and goes to the shelf.
 */
export function NewLoaf() {
  const content = getPlacement();
  const t = content.newLoaf;
  const breads = getBreads();
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();

  const profile = data?.profile ?? null;
  const base = useMemo<PlacementAnswers>(() => (profile ? answersFromProfile(profile) : {}), [profile]);
  const first = useMemo(() => startingPoint(base), [base]);

  const [exactEssentials, setExactEssentials] = useState('');
  const typedEssentials = parseDollarsToCents(exactEssentials);
  const answers = useMemo<PlacementAnswers>(
    () => (first.needsExactInput && typedEssentials ? { ...base, essentialsExactCents: typedEssentials } : base),
    [base, first.needsExactInput, typedEssentials],
  );
  const start = useMemo(() => startingPoint(answers), [answers]);

  const bandLowerCents = base.savings === undefined ? 0 : creditedSavings(base.savings);
  const [choice, setChoice] = useState<GoalChoice>(first.targetMonths ? (String(first.targetMonths) as GoalChoice) : 'default');
  const [customGoal, setCustomGoal] = useState('');
  const [count, setCount] = useState(first.countSavingsByDefault);
  const [savingsText, setSavingsText] = useState(centsToInput(base.savingsExactCents ?? first.existingSavingsCents));
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bread, setBread] = useState<BreadId>(DEFAULT_BREAD);

  if (!profile) return null;
  const choices = data ? breadChoices(data) : null;
  const baked = first.emergencyFundBaked;
  const starterGoal = formatCents(DEFAULT_GOAL_CENTS);

  const typedSavings = parseDollarsToCents(savingsText);
  const counted = count ? typedSavings : 0;
  const targetCents = baked
    ? bakedStartTargetCents(start)
    : choice === 'custom'
      ? parseDollarsToCents(customGoal)
      : choice === 'default'
        ? DEFAULT_GOAL_CENTS
        : start.essentialsCents === null
          ? null
          : targetForMonths(start.essentialsCents, Number(choice) as TargetMonths);
  const coversTarget = !baked && counted !== null && targetCents !== null && counted >= targetCents && counted > 0;
  const canStart = baked || (targetCents !== null && counted !== null && !coversTarget);

  async function submit(confirmed: boolean) {
    if (targetCents === null) return;
    const startingCents = baked ? start.existingSavingsCents : counted && counted > 0 ? counted : null;

    // Keep any exact figures the student typed, so the shelf and later goals use them.
    const keep: PlacementAnswers = { ...base };
    if (first.needsExactInput && typedEssentials) keep.essentialsExactCents = typedEssentials;
    if (!baked && count && typedSavings !== null && typedSavings !== bandLowerCents) keep.savingsExactCents = typedSavings;
    if (JSON.stringify(keep) !== JSON.stringify(base)) await savePlacement(adapter, keep);

    const result = await createFirstLoaf(adapter, 'emergency-fund', targetCents, startingCents, { confirmed, bread });
    if (!result.ok) {
      if (result.needsConfirmation) setConfirming(result.message);
      else setError(result.message);
      return;
    }
    setConfirming(null);
    setError(null);
    await refresh();
    navigate(baked ? '/choose-loaf' : '/lessons', { replace: true });
  }

  if (baked) {
    return (
      <div className="new-loaf">
        <h1 className="screen-title">{t.builtTitle}</h1>
        <DraftNote draft={content.draft} />
        <p>{t.builtBody}</p>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="new-loaf__actions">
          <LoafButton onClick={() => void submit(false)}>{t.chooseNext}</LoafButton>
          <SliceButton onClick={() => navigate('/built-review')}>{t.reviewButton}</SliceButton>
        </div>
        {confirming && <ConfirmSheet message={confirming} yes={t.confirmYes} fix={t.confirmFix} onYes={() => void submit(true)} onFix={() => setConfirming(null)} />}
      </div>
    );
  }

  const monthOptions = start.essentialsCents === null ? [] : MONTH_CHOICES;

  return (
    <div className="new-loaf">
      <h1 className="screen-title">{t.title}</h1>
      <DraftNote draft={content.draft} />

      {first.needsExactInput && (
        <div className="field">
          <p>{t.needsExact}</p>
          <label htmlFor="exact-essentials">{t.exactEssentialsLabel}</label>
          <input id="exact-essentials" inputMode="decimal" value={exactEssentials} onChange={(e) => setExactEssentials(e.target.value)} />
        </div>
      )}

      <fieldset className="choice-group">
        <legend className="choice-group__legend">{t.goalLabel}</legend>
        {first.isDefault && <p className="choice-group__help">{fillTemplate(t.starterNote, { goal: starterGoal })}</p>}
        <div className="choice-group__options">
          {first.isDefault && <GoalRadio id="default" label={`${starterGoal} starter goal`} choice={choice} onPick={setChoice} />}
          {monthOptions.map((m) => (
            <GoalRadio
              key={m}
              id={String(m) as GoalChoice}
              label={`${monthsText(m)}: ${formatCents(targetForMonths(start.essentialsCents as number, m))}`}
              choice={choice}
              onPick={setChoice}
            />
          ))}
          <GoalRadio id="custom" label={t.customLabel} choice={choice} onPick={setChoice} />
        </div>
        {choice === 'custom' && (
          <input aria-label={t.customLabel} inputMode="decimal" value={customGoal} onChange={(e) => setCustomGoal(e.target.value)} placeholder="500" />
        )}
      </fieldset>

      {first.existingSavingsCents > 0 && (
        <div className="field">
          <label className="check">
            <input type="checkbox" checked={count} onChange={(e) => setCount(e.target.checked)} />
            <span>{t.countSavings}</span>
          </label>
          {count && (
            <>
              <label htmlFor="exact-savings">{t.exactSavingsLabel}</label>
              <input id="exact-savings" inputMode="decimal" value={savingsText} onChange={(e) => setSavingsText(e.target.value)} />
            </>
          )}
        </div>
      )}

      {choices?.hasChoice && (
        <section aria-labelledby="new-loaf-bread">
          <h2 id="new-loaf-bread" className="choice-group__legend">{breads.picker.title}</h2>
          <p className="choice-group__help">{breads.picker.intro}</p>
          <BreadPicker copy={breads} available={choices.available} value={bread} onChange={setBread} weeksLeft={choices.weeksLeft} />
        </section>
      )}

      {coversTarget && <p className="notice" role="status">{t.biggerTarget}</p>}
      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="new-loaf__actions">
        <LoafButton onClick={() => void submit(false)} disabled={!canStart}>
          {t.start}
        </LoafButton>
      </div>

      {confirming && <ConfirmSheet message={confirming} yes={t.confirmYes} fix={t.confirmFix} onYes={() => void submit(true)} onFix={() => setConfirming(null)} />}
    </div>
  );
}

function GoalRadio({ id, label, choice, onPick }: { id: GoalChoice; label: string; choice: GoalChoice; onPick: (c: GoalChoice) => void }) {
  return (
    <label className="choice">
      <input className="choice__input" type="radio" name="goal" checked={choice === id} onChange={() => onPick(id)} />
      <span className="choice__label">{label}</span>
    </label>
  );
}

function ConfirmSheet(props: { message: string; yes: string; fix: string; onYes: () => void; onFix: () => void }) {
  return (
    <div className="sheet" role="alertdialog" aria-modal="true" aria-labelledby="confirm-text">
      <div className="sheet__card">
        <p id="confirm-text">{props.message}</p>
        <LoafButton onClick={props.onYes}>{props.yes}</LoafButton>
        <SliceButton onClick={props.onFix}>{props.fix}</SliceButton>
      </div>
    </div>
  );
}
