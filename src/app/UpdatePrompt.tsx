import { useEffect, useRef, useState } from 'react';
import { useAppOpen } from './AppOpen';
import { registerServiceWorker } from './serviceWorker';

export const UPDATE_TITLE = 'New version available';
export const UPDATE_BODY = "Refresh when you're ready. Your loaf is already saved.";

/** The calm "New version available" message. Exported so tests can show it without a service worker. */
export function UpdatePromptView({ onRefresh, onLater }: { onRefresh: () => void; onLater: () => void }) {
  return (
    <div className="update-banner" role="status">
      <p className="update-banner__text">
        <strong>{UPDATE_TITLE}</strong>
        <br />
        {UPDATE_BODY}
      </p>
      <div className="update-banner__actions">
        <button type="button" className="update-banner__button update-banner__button--main" onClick={onRefresh}>
          Refresh
        </button>
        <button type="button" className="update-banner__button" onClick={onLater}>
          Not now
        </button>
      </div>
    </div>
  );
}

/** Shows the message once a new version is waiting. "Not now" hides it until the next time the app opens. */
export function UpdatePrompt() {
  const [waiting, setWaiting] = useState(false);
  const apply = useRef<() => void>(() => undefined);
  const { setUpdateShowing } = useAppOpen();

  // Once-per-open moments (the daily quiz popup) wait while this message is on screen.
  useEffect(() => {
    setUpdateShowing(waiting);
    return () => setUpdateShowing(false);
  }, [waiting, setUpdateShowing]);

  useEffect(() => {
    let live = true;
    void registerServiceWorker(() => {
      if (live) setWaiting(true);
    }).then((update) => {
      apply.current = update;
    });
    return () => {
      live = false;
    };
  }, []);

  if (!waiting) return null;
  return <UpdatePromptView onRefresh={() => apply.current()} onLater={() => setWaiting(false)} />;
}
