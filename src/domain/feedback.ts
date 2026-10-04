/** Feedback from Settings: a message of up to 1,000 characters and an optional category. Never any financial data. */
export const FEEDBACK_MAX = 1000;

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'other'] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

export function isFeedbackCategory(value: unknown): value is FeedbackCategory {
  return (FEEDBACK_CATEGORIES as readonly unknown[]).includes(value);
}

/** The message as it will be sent: trimmed, or null when there is nothing to send or it is too long. */
export function cleanFeedback(message: string): string | null {
  const text = message.trim();
  return text.length >= 1 && text.length <= FEEDBACK_MAX ? text : null;
}

/** Only the path of a screen, never its query string or hash, so nothing a student typed or opened is sent. */
export function screenPath(pathname: string): string {
  return pathname.split(/[?#]/)[0].slice(0, 200);
}

/** The `feedback` table row for an account user. The user id comes from the session, and Row Level Security checks it. */
export interface FeedbackRow {
  user_id: string;
  category: FeedbackCategory | null;
  message: string;
  app_version: string;
  screen: string;
}

export function feedbackRow(
  userId: string,
  input: { message: string; category: FeedbackCategory | null; appVersion: string; screen: string },
): FeedbackRow | null {
  const message = cleanFeedback(input.message);
  if (message === null) return null;
  return {
    user_id: userId,
    category: input.category,
    message,
    app_version: input.appVersion.slice(0, 100),
    screen: screenPath(input.screen),
  };
}

/** A `mailto:` link for the demo user, who has no account to send feedback through. */
export function mailtoHref(to: string, subject: string, bodyLines: readonly string[]): string {
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
}
