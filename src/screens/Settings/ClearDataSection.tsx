import { useState } from 'react';
import type { Account } from '../../app/AuthProvider';
import { getSettings } from '../../content/loader';
import { clearAppData, deviceDeps } from '../../data/clearAppData';

/** Where the app starts again after clearing: the login screen, with demo mode still on so this tool stays within reach. */
export const AFTER_CLEAR_PATH = '/login?demo=1';

/** Clears the device, then loads the app again at the login screen. Tests pass fakes for both. */
export interface ClearActions {
  clear: () => Promise<{ ok: boolean }>;
  reload: () => void;
}

const real: ClearActions = {
  clear: () => clearAppData(deviceDeps()),
  // `replace`, so the back button doesn't return to a screen that no longer has data.
  reload: () => window.location.replace(AFTER_CLEAR_PATH),
};

/**
 * "Clear app data", behind `?demo=1`. After a confirmation it clears everything this device stores for Dough!
 * (local demo data, the offline copy of account data, the service worker and its caches) and loads the app again at
 * the login screen. For a signed-in account it signs out on this device only. It never deletes anything in Supabase.
 */
export function ClearDataSection({ account, actions = real }: { account: Account | null; actions?: ClearActions }) {
  const t = getSettings().clearData;
  const [state, setState] = useState<'idle' | 'asking' | 'working' | 'failed'>('idle');

  async function run() {
    setState('working');
    const ok = await actions.clear().then(
      (result) => result.ok,
      () => false,
    );
    if (ok) actions.reload();
    else setState('failed');
  }

  return (
    <section className="settings__section" aria-labelledby="settings-clear">
      <div className="demo-tools">
        <h2 id="settings-clear" className="demo-tools__title">
          {t.title}
        </h2>
        {state === 'asking' || state === 'working' ? (
          <div className="demo-tools__ask" role="group" aria-label={t.title}>
            <p className="demo-tools__note">{account ? t.askAccount : t.askDemo}</p>
            <div className="demo-tools__row">
              <button type="button" className="demo-tools__button" disabled={state === 'working'} onClick={() => void run()}>
                {state === 'working' ? t.working : t.confirm}
              </button>
              <button type="button" className="demo-tools__button" disabled={state === 'working'} onClick={() => setState('idle')}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="demo-tools__note">{t.intro}</p>
            <button type="button" className="demo-tools__button" onClick={() => setState('asking')}>
              {t.button}
            </button>
          </>
        )}
        {state === 'failed' && (
          <p className="demo-tools__note" role="alert">
            {t.failed}
          </p>
        )}
      </div>
    </section>
  );
}
