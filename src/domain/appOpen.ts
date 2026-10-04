/** The app counts as opened again after this long in the background. */
export const REOPEN_AFTER_MS = 30 * 60 * 1000;

/**
 * One "app open": a fresh launch, or a return to the foreground after at least 30 minutes away. Each open gets one
 * chance to show a once-per-open moment (the daily quiz popup). `hiddenAt` is the real time the app went to the background.
 */
export interface OpenState {
  pending: boolean;
  hiddenAt: number | null;
}

export const freshLaunch = (): OpenState => ({ pending: true, hiddenAt: null });

/** The chance is used up: the moment was shown, or the student moved on to another screen. */
export const spendOpen = (state: OpenState): OpenState => (state.pending ? { ...state, pending: false } : state);

export const wentToBackground = (state: OpenState, nowMs: number): OpenState =>
  state.hiddenAt === null ? { ...state, hiddenAt: nowMs } : state;

/**
 * The app is back in front. A long enough absence starts a new open, but only when the student is on Home: a return
 * on another screen never shows the moment later when they navigate to Home.
 */
export function cameToForeground(state: OpenState, nowMs: number, onHome: boolean): OpenState {
  const away = state.hiddenAt === null ? 0 : nowMs - state.hiddenAt;
  return { pending: away >= REOPEN_AFTER_MS ? onHome : state.pending, hiddenAt: null };
}
