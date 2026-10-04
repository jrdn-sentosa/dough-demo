import { useNavigate } from 'react-router';
import { DraftNote } from '../components/DraftNote';
import { LoafButton } from '../components/LoafButton';
import { PreviewAbout } from '../components/PreviewAbout';
import { SliceButton } from '../components/SliceButton';
import { getPreview, getSettings } from '../content/loader';
import { mailtoHref } from '../domain/feedback';
import { useAppOpen } from './AppOpen';
import { useData } from './DataProvider';

/** Where "Send feedback" goes for someone with an account or the demo: the feedback form in Settings. */
export const FEEDBACK_PATH = '/settings#settings-feedback';

/**
 * The one-time early-preview welcome. It shows the first time the app opens on a device (signed in or not) and is
 * remembered on the device once dismissed. It never stacks on another moment: it waits for the "New version available"
 * banner and for anything showing on Home, and the daily quiz popup waits for it.
 */
export function PreviewNotice() {
  const { noticeUnseen, dismissNotice, updateShowing, momentShowing } = useAppOpen();
  const { data } = useData();
  const navigate = useNavigate();
  const copy = getPreview();

  if (!data || !noticeUnseen || updateShowing || momentShowing) return null;

  // Before sign-in there is no Settings screen to go to, so feedback opens an email instead.
  const mailto = mailtoHref(getSettings().feedback.emailTo, copy.notice.feedbackSubject, []);

  return (
    <div
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-notice-title"
      onKeyDown={(e) => {
        if (e.key === 'Escape') dismissNotice();
      }}
    >
      <div className="sheet__card preview-notice">
        <h2 id="preview-notice-title">{copy.about.title}</h2>
        <PreviewAbout />
        <DraftNote draft={copy.draft} />
        <LoafButton autoFocus onClick={dismissNotice}>
          {copy.notice.gotIt}
        </LoafButton>
        {data.user ? (
          <SliceButton
            onClick={() => {
              dismissNotice();
              navigate(FEEDBACK_PATH);
            }}
          >
            {copy.notice.sendFeedback}
          </SliceButton>
        ) : (
          <a className="slice-button" href={mailto} onClick={dismissNotice}>
            {copy.notice.sendFeedback}
          </a>
        )}
      </div>
    </div>
  );
}
