import type { AppData } from '../data/types';
import { savingUnlocked } from '../domain/lessons';
import { statusFor } from '../money/ledger';

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

/**
 * Lessons are done but no saving habit is picked yet. Home waits for Saving setup (skipping it saves
 * the suggested weekly amount, so this ends). A fund that has been baked, even at the start, skips it.
 */
function needsHabit(data: AppData): boolean {
  return data.loaves.length > 0 && data.habit === null && !data.loaves.some((l) => l.bakes.length > 0);
}

/** Some loaf has been baked, so the celebration and the bread shelf have something to show. */
function hasBaked(data: AppData): boolean {
  return data.loaves.some((l) => l.bakes.length > 0);
}

/**
 * "Choose your next loaf" is open when a loaf is baked and sitting at its target: not rebuilding after
 * a withdrawal, and not partway through growing. (Growing is how a student keeps saving; a new loaf starts from here.)
 */
export function canChooseNext(data: AppData): boolean {
  return data.loaves.some((l) => {
    const status = statusFor(data, l);
    return status.baked && status.percent >= 100 && !status.growing;
  });
}

/** Where the student goes once their first loaf exists: a fund that starts baked goes on to choose the next loaf, a new one to its lessons. */
function afterFirstLoaf(data: AppData): string {
  if (data.loaves.some((l) => l.bakes.length > 0)) return '/choose-loaf';
  return needsLessons(data) ? '/lessons' : '/';
}

/** The placement quiz can be reopened to retake it (`?retake=1`). Anything else sends a student with a loaf home. */
const isRetake = (search: string) => new URLSearchParams(search).get('retake') === '1';

/**
 * The route guard. Returns where to send the student, or null to let the route show.
 * First-time users go through every step in order; returning users land on Home.
 */
export function guardRedirect(pathname: string, data: AppData, search = ''): string | null {
  if (pathname === '/login') return data.user ? destinationFor(data) : null;
  if (!data.user) return '/login';
  const hasLoaf = data.loaves.length > 0;
  switch (pathname) {
    case '/placement':
      return hasLoaf && !isRetake(search) ? '/' : null;
    case '/placement/result':
    case '/new-loaf':
    case '/built-review':
      if (!data.profile) return '/placement';
      return hasLoaf ? afterFirstLoaf(data) : null;
    case '/choose-loaf':
    case '/risk-quiz':
      if (!hasLoaf) return destinationFor(data);
      return canChooseNext(data) ? null : '/';
    case '/risk-result':
      if (!hasLoaf) return destinationFor(data);
      if (!canChooseNext(data)) return '/';
      return data.profile?.risk ? null : '/choose-loaf';
    case '/loaf-complete':
    case '/shelf':
      if (!hasLoaf) return destinationFor(data);
      return hasBaked(data) ? null : '/';
    case '/':
      if (!hasLoaf) return destinationFor(data);
      if (needsLessons(data)) return '/lessons';
      return needsHabit(data) ? '/saving-setup' : null;
    case '/lessons':
    case '/quiz':
    case '/points':
    case '/daily-quiz':
      return hasLoaf ? null : destinationFor(data);
    case '/saving-setup':
      if (!hasLoaf) return destinationFor(data);
      return needsLessons(data) ? '/lessons' : null;
    default:
      if (pathname.startsWith('/lessons/')) return hasLoaf ? null : destinationFor(data);
      return null;
  }
}
