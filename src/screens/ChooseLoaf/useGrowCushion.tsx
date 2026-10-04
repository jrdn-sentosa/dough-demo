import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useData } from '../../app/DataProvider';
import { AmountSheet } from '../../components/AmountSheet';
import { getLoaf } from '../../content/loader';
import { saveEssentials } from '../../data/profile';
import type { BreadId } from '../../domain/breads';
import { growGoal } from '../../domain/targets';
import { setTarget } from '../../money/ledger';
import { parseDollarsToCents } from '../../money/parse';
import { FLOW_LOAF } from '../useLessonFlow';

export type GrowMonths = 3 | 6;

export interface GrowCushion {
  /**
   * Start growing the cushion to this many months, in this bread (the default when left out).
   * Asks for monthly essentials first when they are unknown.
   */
  start: (months: GrowMonths, bread?: BreadId) => void;
  /** The essentials question, or null. Render it in the screen. */
  sheet: ReactNode;
  /** Why growing didn't work (from the money layer), or null. */
  error: string | null;
}

/**
 * "Grow your cushion": raises the target on the same emergency fund loaf with `setTarget(..., { grow: true })`
 * and goes to Home, where the growth shows as a new dough ball. Used by Choose your next loaf and the risk result.
 */
export function useGrowCushion(): GrowCushion {
  const { adapter, data, refresh } = useData();
  const navigate = useNavigate();
  const loaf = getLoaf(FLOW_LOAF);
  if (loaf.status !== 'built') throw new Error('growing needs a built loaf');
  const copy = loaf.flow.choose.essentials;

  const [asking, setAsking] = useState<{ months: GrowMonths; bread: BreadId | undefined } | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function apply(months: GrowMonths, essentialsCents: number, bread: BreadId | undefined): Promise<boolean> {
    const goal = growGoal(essentialsCents, months);
    if (goal.targetCents === null) return false;
    const result = await setTarget(adapter, FLOW_LOAF, goal.targetCents, { grow: true, bread });
    if (!result.ok) {
      setError(result.message);
      return false;
    }
    await refresh();
    if (result.baked) navigate('/loaf-complete', { state: { grown: true } });
    else navigate('/', { replace: true });
    return true;
  }

  function start(months: GrowMonths, bread?: BreadId) {
    setError(null);
    const essentials = data?.profile?.essentialsCents ?? null;
    if (essentials === null) {
      setText('');
      setAsking({ months, bread });
    } else {
      void apply(months, essentials, bread);
    }
  }

  const cents = parseDollarsToCents(text);
  async function confirm() {
    if (asking === null || cents === null || cents <= 0) return;
    await saveEssentials(adapter, cents);
    if (await apply(asking.months, cents, asking.bread)) setAsking(null);
  }

  const option = asking?.months === 6 ? loaf.growFurtherOption : loaf.growOption;
  const sheet =
    asking === null ? null : (
      <AmountSheet
        id="essentials"
        title={option.title}
        intro={<p>{option.askEssentials}</p>}
        label={copy.label}
        value={text}
        onChange={(v) => {
          setText(v);
          setError(null);
        }}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        disabled={cents === null || cents <= 0}
        error={error ?? (text.trim() !== '' && cents === null ? copy.invalid : null)}
        onConfirm={() => void confirm()}
        onCancel={() => setAsking(null)}
      />
    );

  return { start, sheet, error };
}
