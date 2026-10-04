import type { AppData } from '../data/types';

/** Where the student belongs right now: login, placement, the result, or Home. */
export function destinationFor(data: AppData): string {
  if (!data.user) return '/login';
  if (!data.profile) return '/placement';
  if (data.loaves.length === 0) return '/placement/result';
  return '/';
}

/** Where the student goes once their first loaf exists: a fund that starts baked goes on to choose the next loaf. */
function afterFirstLoaf(data: AppData): string {
  return data.loaves.some((l) => l.bakes.length > 0) ? '/choose-loaf' : '/';
}

/**
 * The route guard. Returns where to send the student, or null to let the route show.
 * First-time users go through every step in order; returning users land on Home.
 */
export function guardRedirect(pathname: string, data: AppData): string | null {
  if (pathname === '/login') return data.user ? destinationFor(data) : null;
  if (!data.user) return '/login';
  const hasLoaf = data.loaves.length > 0;
  switch (pathname) {
    case '/placement':
      return hasLoaf ? '/' : null;
    case '/placement/result':
    case '/new-loaf':
    case '/built-review':
      if (!data.profile) return '/placement';
      return hasLoaf ? afterFirstLoaf(data) : null;
    case '/choose-loaf':
    case '/':
      return hasLoaf ? null : destinationFor(data);
    default:
      return null;
  }
}
