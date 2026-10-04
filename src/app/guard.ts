import type { AppData } from '../data/types';
import { savingUnlocked } from '../domain/lessons';

/** Where the student belongs right now: login, placement, the result, or Home. */
export function destinationFor(data: AppData): string {
  if (!data.user) return '/login';
  if (!data.profile) return '/placement';
  if (data.loaves.length === 0) return '/placement/result';
  return '/';
}

/**
 * A new loaf whose lessons and quiz aren't done yet. Saving setup opens after a normal quiz
 * (any score) or a passing test-out. A loaf that has been baked, even at the start, skips this.
 */
function needsLessons(data: AppData): boolean {
  return (
    data.loaves.length > 0 &&
    !data.loaves.some((l) => l.bakes.length > 0) &&
    !savingUnlocked(data.quizAttempts)
  );
}

/** Where the student goes once their first loaf exists: a fund that starts baked goes on to choose the next loaf, a new one to its lessons. */
function afterFirstLoaf(data: AppData): string {
  if (data.loaves.some((l) => l.bakes.length > 0)) return '/choose-loaf';
  return needsLessons(data) ? '/lessons' : '/';
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
      return hasLoaf ? null : destinationFor(data);
    case '/':
      if (!hasLoaf) return destinationFor(data);
      return needsLessons(data) ? '/lessons' : null;
    case '/lessons':
    case '/quiz':
      return hasLoaf ? null : destinationFor(data);
    case '/saving-setup':
      if (!hasLoaf) return destinationFor(data);
      return needsLessons(data) ? '/lessons' : null;
    default:
      if (pathname.startsWith('/lessons/')) return hasLoaf ? null : destinationFor(data);
      return null;
  }
}
