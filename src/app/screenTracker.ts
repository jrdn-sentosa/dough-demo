import { screenPath } from '../domain/feedback';

let previous: string | null = null;
let current: string | null = null;

/** Remembers the last two screens (paths only), so feedback sent from Settings says where the student came from. */
export function trackScreen(pathname: string): void {
  const path = screenPath(pathname);
  if (path === current) return;
  previous = current;
  current = path;
}

/** For tests: forget the screens seen so far. */
export function resetScreenTracker(): void {
  previous = null;
  current = null;
}

/** The screen to report with feedback: the one before the current screen if there was one, otherwise the current one. */
export function screenForFeedback(pathname: string): string {
  const path = screenPath(pathname);
  return current === path && previous ? previous : path;
}
