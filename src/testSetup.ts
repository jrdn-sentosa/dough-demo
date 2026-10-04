import { beforeEach } from 'vitest';
import { PREVIEW_NOTICE_KEY } from './app/previewNoticeStore';

// Screen tests start as if the early-preview welcome was already dismissed on this device, so it never covers the
// screen under test. The notice's own tests remove the key.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.setItem(PREVIEW_NOTICE_KEY, '1');
});
