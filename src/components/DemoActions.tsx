import { useState } from 'react';
import { useData } from '../app/DataProvider';
import { getBreads } from '../content/loader';
import { resetDemo, startFreshDemo } from '../money/demo';

type Action = 'reset' | 'fresh';

/**
 * Demo tools that replace the local demo data: "Reset demo" (Maya's seed again) and "Start fresh demo" (the first-time
 * flow). Only ever rendered for the local demo user or a signed-out device, behind `?demo=1`. Each asks first,
 * because it replaces what is on this device. The money layer refuses for real accounts as well.
 */
export function DemoActions({ actions }: { actions: readonly Action[] }) {
  const { adapter, refresh } = useData();
  const copy = getBreads().demo;
  const [asking, setAsking] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    const result = action === 'reset' ? await resetDemo(adapter) : await startFreshDemo(adapter);
    setAsking(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    await refresh();
  }

  const labels: Record<Action, { button: string; note: string }> = {
    reset: { button: copy.resetDemo, note: copy.resetDemoNote },
    fresh: { button: copy.startFresh, note: copy.startFreshNote },
  };

  return (
    <div className="demo-tools">
      <h2 className="demo-tools__title">{copy.heading}</h2>
      {actions.map((action) =>
        asking === action ? (
          <div key={action} className="demo-tools__ask" role="group" aria-label={labels[action].button}>
            <p className="demo-tools__note">{labels[action].note}</p>
            <div className="demo-tools__row">
              <button type="button" className="demo-tools__button" onClick={() => void run(action)}>
                {copy.confirm}
              </button>
              <button type="button" className="demo-tools__button" onClick={() => setAsking(null)}>
                {copy.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button key={action} type="button" className="demo-tools__button" onClick={() => setAsking(action)}>
            {labels[action].button}
          </button>
        ),
      )}
      {error && (
        <p className="demo-tools__note" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
