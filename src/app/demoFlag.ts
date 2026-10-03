const KEY = 'dough.demo';

/**
 * Demo mode is on with `?demo=1` in the URL or VITE_DEMO_MODE=true.
 * The URL flag is remembered for the session, so in-app navigation
 * (which drops the query string) keeps demo mode on.
 */
export function isDemoMode(): boolean {
  if (import.meta.env.VITE_DEMO_MODE === 'true') return true;
  const inUrl = new URLSearchParams(window.location.search).get('demo') === '1';
  try {
    if (inUrl) sessionStorage.setItem(KEY, '1');
    return inUrl || sessionStorage.getItem(KEY) === '1';
  } catch {
    return inUrl;
  }
}
