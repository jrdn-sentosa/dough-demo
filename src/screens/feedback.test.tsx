// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { resetScreenTracker, trackScreen } from '../app/screenTracker';
import { APP_VERSION } from '../appVersion';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import { FEEDBACK_MAX, feedbackRow, mailtoHref, screenPath } from '../domain/feedback';
import { profileFromAnswers } from '../domain/profile';
import { SettingsView } from './Settings';

afterEach(() => {
  cleanup();
  resetScreenTracker();
});

const data = { ...emptyData(), user: { email: 'sam@school.edu' }, profile: profileFromAnswers({ essentials: '500-749' }) };
const account = { id: 'user-1', email: 'sam@school.edu' };

function mountSettings(props: Partial<Parameters<typeof SettingsView>[0]> = {}) {
  const router = createMemoryRouter(
    [{ path: '/settings', element: <SettingsView account={null} onSignOut={async () => undefined} {...props} /> }],
    { initialEntries: ['/settings?secret=1'] },
  );
  render(
    <DataProvider adapter={createMemoryAdapter(data)}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
}

const box = () => screen.findByRole('textbox', { name: 'Your feedback' });

describe('Send feedback for a signed-in student', () => {
  it('sends the message, category, version and screen path, then clears the box', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue(undefined);
    trackScreen('/lessons/ef-how-much');
    trackScreen('/settings');
    mountSettings({ account, sendFeedback: send });

    await user.type(await box(), '  The quiz was clear.  ');
    await user.click(screen.getByRole('radio', { name: 'An idea' }));
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));

    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    expect(send).toHaveBeenCalledWith({
      user_id: 'user-1',
      category: 'idea',
      message: 'The quiz was clear.',
      app_version: APP_VERSION,
      // Where the student came from, as a path only. Nothing from the query string.
      screen: '/lessons/ef-how-much',
    });
    expect(await screen.findByText('Thanks. Your feedback was sent.')).toBeTruthy();
    expect((await box() as HTMLTextAreaElement).value).toBe('');
  });

  it('works with no category', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockResolvedValue(undefined);
    mountSettings({ account, sendFeedback: send });
    await user.type(await box(), 'Hello');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    await waitFor(() => expect(send).toHaveBeenCalled());
    expect(send.mock.calls[0][0].category).toBeNull();
  });

  it('cannot send an empty or blank message', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    mountSettings({ account, sendFeedback: send });
    const button = await screen.findByRole('button', { name: 'Send feedback' });
    expect(button.hasAttribute('disabled')).toBe(true);
    await user.type(await box(), '   ');
    expect(button.hasAttribute('disabled')).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it('caps the message at 1,000 characters and shows a count', async () => {
    mountSettings({ account, sendFeedback: vi.fn() });
    const field = (await box()) as HTMLTextAreaElement;
    expect(field.maxLength).toBe(FEEDBACK_MAX);
    expect(screen.getByText('0 of 1000')).toBeTruthy();
  });

  it('keeps the message and says so when it could not be sent', async () => {
    const user = userEvent.setup();
    const send = vi.fn().mockRejectedValue(new Error('offline'));
    mountSettings({ account, sendFeedback: send });
    await user.type(await box(), 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(await screen.findByText("That didn't send. Check your connection and try again.")).toBeTruthy();
    expect((await box() as HTMLTextAreaElement).value).toBe('Keep me');
  });

  it('asks people to keep financial details out', async () => {
    mountSettings({ account, sendFeedback: vi.fn() });
    expect(await screen.findByText(/Please don't include account numbers/)).toBeTruthy();
  });
});

describe('Send feedback for the demo user', () => {
  it('has no send button, and opens an email with the message once there is one', async () => {
    const user = userEvent.setup();
    const send = vi.fn();
    mountSettings({ account: null, sendFeedback: send });
    expect((await screen.findByRole('button', { name: 'Email my feedback' })).hasAttribute('disabled')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Send feedback' })).toBeNull();

    await user.type(await box(), 'Love it');
    await user.click(screen.getByRole('radio', { name: 'Something else' }));
    const link = screen.getByRole('link', { name: 'Email my feedback' });
    const href = link.getAttribute('href') ?? '';
    expect(href.startsWith('mailto:originaldoughmoney@gmail.com?subject=Dough!%20feedback&body=')).toBe(true);
    const body = decodeURIComponent(href.split('&body=')[1]);
    expect(body).toContain('Love it');
    expect(body).toContain(`App version: ${APP_VERSION}`);
    expect(body).toContain('Screen: /settings');
    expect(body).toContain('Kind: Something else');
    expect(send).not.toHaveBeenCalled();
  });
});

describe('Settings shows the app version', () => {
  it('says which version this is', async () => {
    mountSettings({ account });
    expect(await screen.findByText(`Version ${APP_VERSION}`)).toBeTruthy();
  });
});

describe('feedback rules', () => {
  const input = { message: 'Hi', category: null, appVersion: '1.0.0', screen: '/settings' };

  it('builds a row only for a message that is 1 to 1,000 characters after trimming', () => {
    expect(feedbackRow('u', input)).toMatchObject({ user_id: 'u', message: 'Hi', category: null });
    expect(feedbackRow('u', { ...input, message: '   ' })).toBeNull();
    expect(feedbackRow('u', { ...input, message: 'a'.repeat(FEEDBACK_MAX) })).not.toBeNull();
    expect(feedbackRow('u', { ...input, message: 'a'.repeat(FEEDBACK_MAX + 1) })).toBeNull();
  });

  it('sends only the path of a screen', () => {
    expect(screenPath('/lessons/abc?t=30&email=x#top')).toBe('/lessons/abc');
    expect(feedbackRow('u', { ...input, screen: '/quiz?mode=test-out' })?.screen).toBe('/quiz');
  });

  it('puts the subject and body in a mailto link', () => {
    expect(mailtoHref('a@b.co', 'Hi there', ['one', 'two'])).toBe('mailto:a@b.co?subject=Hi%20there&body=one%0Atwo');
  });
});
