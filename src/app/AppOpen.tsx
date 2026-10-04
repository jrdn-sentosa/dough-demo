import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router';
import { cameToForeground, freshLaunch, spendOpen, wentToBackground } from '../domain/appOpen';
import { realNow } from '../money/clock';

interface AppOpenValue {
  /** This app open hasn't used its one chance yet, and the student is still on the screen it started on (Home). */
  pending: boolean;
  /** Uses up the chance: the moment was shown and closed. */
  spend: () => void;
  /** The "New version available" banner is on screen, so once-per-open moments wait. */
  updateShowing: boolean;
  setUpdateShowing: (showing: boolean) => void;
}

const AppOpenContext = createContext<AppOpenValue>({
  pending: false,
  spend: () => undefined,
  updateShowing: false,
  setUpdateShowing: () => undefined,
});

export const useAppOpen = () => useContext(AppOpenContext);

/**
 * Tracks "app opens" for moments that show once per open: a fresh launch, or the app coming back to the front after
 * at least 30 minutes in the background. The chance is spent as soon as the student is on any screen other than Home,
 * so navigating back to Home never brings the moment back. The time away is real time, not the demo clock.
 */
export function AppOpenProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // A launch on any screen other than Home has already used its chance.
  const [open, setOpen] = useState(() => (pathname === '/' ? freshLaunch() : spendOpen(freshLaunch())));
  const [lastPath, setLastPath] = useState(pathname);
  const [updateShowing, setUpdateShowing] = useState(false);
  const onHome = useRef(pathname === '/');

  // Moving to another screen spends the chance for good (adjusted while rendering, so no screen sees it for a moment).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (pathname !== '/') setOpen(spendOpen);
  }

  useEffect(() => {
    onHome.current = pathname === '/';
  }, [pathname]);

  useEffect(() => {
    const change = () => {
      const nowMs = realNow().getTime();
      if (document.visibilityState === 'hidden') setOpen((s) => wentToBackground(s, nowMs));
      else setOpen((s) => cameToForeground(s, nowMs, onHome.current));
    };
    document.addEventListener('visibilitychange', change);
    return () => document.removeEventListener('visibilitychange', change);
  }, []);

  const spend = useCallback(() => setOpen(spendOpen), []);
  const value = useMemo(
    () => ({ pending: open.pending, spend, updateShowing, setUpdateShowing }),
    [open.pending, spend, updateShowing],
  );
  return <AppOpenContext.Provider value={value}>{children}</AppOpenContext.Provider>;
}
