/** Browser storage key for "this device has seen the early-preview welcome". Device-wide, not tied to a user or the demo. */
export const PREVIEW_NOTICE_KEY = 'dough.previewNoticeSeen';

/** Whether the welcome notice was already dismissed on this device. Blocked storage counts as "not seen". */
export function previewNoticeSeen(): boolean {
  try {
    return window.localStorage.getItem(PREVIEW_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Remembers the dismissal on this device. If storage is blocked, the notice is still closed for this visit. */
export function markPreviewNoticeSeen(): void {
  try {
    window.localStorage.setItem(PREVIEW_NOTICE_KEY, '1');
  } catch {
    // Nothing to do: the app keeps working without it.
  }
}
