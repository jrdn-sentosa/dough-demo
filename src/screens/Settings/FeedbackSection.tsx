import { useState } from 'react';
import { useLocation } from 'react-router';
import type { Account } from '../../app/AuthProvider';
import { screenForFeedback } from '../../app/screenTracker';
import { APP_VERSION } from '../../appVersion';
import { ChoiceGroup } from '../../components/ChoiceGroup';
import { SliceButton } from '../../components/SliceButton';
import { getPreview, getSettings } from '../../content/loader';
import { fillTemplate } from '../../content/template';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_MAX,
  cleanFeedback,
  feedbackRow,
  isFeedbackCategory,
  mailtoHref,
  type FeedbackCategory,
  type FeedbackRow,
} from '../../domain/feedback';

export type FeedbackSender = (row: FeedbackRow) => Promise<void>;

/**
 * "Send feedback": a message of up to 1,000 characters and an optional category. A signed-in student's feedback is
 * saved to the `feedback` table (insert only). The demo user has no account, so Send opens an email to the
 * address in content instead. Only the app version and the screen's path go along, never any financial data.
 */
export function FeedbackSection({ account, send }: { account: Account | null; send: FeedbackSender }) {
  const t = getSettings().feedback;
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<FeedbackCategory | null>(null);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  const categoryLabels: Record<FeedbackCategory, string> = {
    bug: t.categoryBug,
    idea: t.categoryIdea,
    other: t.categoryOther,
  };
  const clean = cleanFeedback(message);
  const screen = screenForFeedback(pathname);

  async function submit() {
    if (!account) return;
    const row = feedbackRow(account.id, { message, category, appVersion: APP_VERSION, screen });
    if (!row) return;
    setState('sending');
    try {
      await send(row);
      setMessage('');
      setCategory(null);
      setState('sent');
    } catch {
      setState('failed');
    }
  }

  const mailto = mailtoHref(t.emailTo, t.emailSubject, [
    clean ?? '',
    '',
    fillTemplate(t.emailVersion, { version: APP_VERSION }),
    fillTemplate(t.emailScreen, { screen }),
    ...(category ? [fillTemplate(t.emailKind, { category: categoryLabels[category] })] : []),
  ]);

  return (
    <section className="settings__section feedback-form" aria-labelledby="settings-feedback">
      <h2 id="settings-feedback" className="settings__heading">
        {t.title}
      </h2>
      <p className="settings__text">{t.intro}</p>

      <ChoiceGroup
        legend={t.categoryLegend}
        options={FEEDBACK_CATEGORIES.map((id) => ({ id, label: categoryLabels[id] }))}
        kind="single"
        name="feedback-category"
        value={category ? [category] : []}
        onChange={(id) => {
          if (isFeedbackCategory(id)) setCategory(id);
        }}
      />

      <label className="feedback-form__label" htmlFor="feedback-message">
        {t.label}
      </label>
      <textarea
        id="feedback-message"
        className="feedback-form__text"
        rows={5}
        aria-describedby={category === 'bug' ? 'feedback-bug-hint' : undefined}
        maxLength={FEEDBACK_MAX}
        placeholder={t.placeholder}
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (state !== 'sending') setState('idle');
        }}
      />
      {category === 'bug' && (
        <p id="feedback-bug-hint" className="settings__text">
          {getPreview().bugHint}
        </p>
      )}
      <p className="feedback-form__count" aria-live="off">
        {fillTemplate(t.counter, { count: String(message.length), max: String(FEEDBACK_MAX) })}
      </p>
      <p className="settings__text">{t.privacy}</p>

      {account ? (
        <SliceButton onClick={() => void submit()} disabled={clean === null || state === 'sending'}>
          {state === 'sending' ? t.sending : t.send}
        </SliceButton>
      ) : (
        <>
          <p className="settings__text">{t.demoNote}</p>
          {clean === null ? (
            <SliceButton disabled>{t.demoSend}</SliceButton>
          ) : (
            <a className="slice-button" href={mailto}>
              {t.demoSend}
            </a>
          )}
        </>
      )}

      {state === 'sent' && (
        <p className="notice" role="status">
          {t.sent}
        </p>
      )}
      {state === 'failed' && (
        <p className="notice" role="status">
          {t.failed}
        </p>
      )}
      <p className="settings__text">{fillTemplate(t.version, { version: APP_VERSION })}</p>
    </section>
  );
}
