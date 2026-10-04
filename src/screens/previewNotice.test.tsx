// @vitest-environment jsdom
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { PREVIEW_NOTICE_KEY, previewNoticeSeen } from '../app/previewNoticeStore';
import { routes } from '../app/router';
import { getPreview } from '../content/loader';
import { parsePreview } from '../content/loader';
import { ContentError } from '../content/guards';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { addStarting, startLoaf } from '../money/ledger';
import previewJson from '../../content/preview.json';

const EF = 'emergency-fund';
const SLOW = { timeout: 5000 };
const copy = getPreview();

beforeEach(() => {
  // The test setup marks the notice as seen on every device; these tests are about the first open.
  window.localStorage.removeItem(PREVIEW_NOTICE_KEY);
});
afterEach(cleanup);

function mount(adapter: DataAdapter, path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return router;
}

const notice = () => screen.queryByRole('dialog', { name: copy.about.title });
const findNotice = () => screen.findByRole('dialog', { name: copy.about.title }, SLOW);

/** A returning student on Home with a mastered module (so the daily quiz is waiting) and an unseen bread unlock. */
async function homeAdapter(unseenUnlock = false): Promise<DataAdapter> {
  const attempt: QuizAttempt = {
    id: 'quiz-1', loafId: EF, mode: 'lesson', score: 4, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z',
  };
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user: { email: 'a@b.co' },
    profile: profileFromAnswers({ essentials: '250-499', accounts: ['checking'], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [attempt],
  });
  await startLoaf(adapter, EF, 40000);
  await addStarting(adapter, EF, 24000);
  await saveHabit(adapter, { kind: 'weekly', amountCents: 3500 });
  if (unseenUnlock) {
    const data = await adapter.load();
    data.streaks.unlocked = [{ bread: 'baguette', at: '2026-01-01T00:00:00.000Z', seen: false }];
    await adapter.save(data);
  }
  return adapter;
}

describe('the early-preview welcome notice', () => {
  it('shows the first time the app opens, before sign-in, with the title, text and the not-here list', async () => {
    mount(createMemoryAdapter(), '/login');
    const dialog = await findNotice();
    expect(within(dialog).getByText(copy.about.body)).toBeTruthy();
    expect(within(dialog).getByText(copy.about.notHereTitle)).toBeTruthy();
    const items = within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual(['Lesson videos', 'Investing loaves', 'Bank linking']);
    expect(within(dialog).getByRole('button', { name: 'Got it' })).toBeTruthy();
  });

  it('is dismissed with "Got it", remembered on the device, and does not come back on the next open', async () => {
    const user = userEvent.setup({ delay: null });
    mount(createMemoryAdapter(), '/login');
    await findNotice();
    expect(previewNoticeSeen()).toBe(false);
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(notice()).toBeNull();
    expect(previewNoticeSeen()).toBe(true);

    cleanup();
    mount(createMemoryAdapter(), '/login');
    await screen.findByText('Continue as demo user', {}, SLOW);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(notice()).toBeNull();
  });

  it('shows once per device, not once per sign-in: signing in after seeing it shows nothing more', async () => {
    const user = userEvent.setup({ delay: null });
    const adapter = createMemoryAdapter();
    mount(adapter, '/login');
    await findNotice();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    await user.click(await screen.findByRole('button', { name: 'Continue as demo user' }));
    // Signing in moves on to the placement quiz; the welcome does not come back.
    await screen.findByRole('progressbar', {}, SLOW);
    expect(notice()).toBeNull();
  });

  it('shows after sign-in too when this is the first open on the device', async () => {
    mount(await homeAdapter(), '/');
    expect(await findNotice()).toBeTruthy();
  });

  it('opens the feedback form in Settings for someone who is signed in, and counts as dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    const router = mount(await homeAdapter(), '/');
    await findNotice();
    await user.click(screen.getByRole('button', { name: 'Send feedback' }));
    expect(router.state.location.pathname).toBe('/settings');
    expect(router.state.location.hash).toBe('#settings-feedback');
    expect(notice()).toBeNull();
    expect(previewNoticeSeen()).toBe(true);
    expect(await screen.findByRole('heading', { name: 'Send feedback' }, SLOW)).toBeTruthy();
  });

  it('offers an email for feedback before sign-in, where there is no Settings screen', async () => {
    const user = userEvent.setup({ delay: null });
    mount(createMemoryAdapter(), '/login');
    const link = within(await findNotice()).getByRole('link', { name: 'Send feedback' });
    expect(link.getAttribute('href')).toMatch(/^mailto:originaldoughmoney@gmail\.com\?subject=/);
    // Stop the browser from trying to follow the mailto link.
    link.addEventListener('click', (e) => e.preventDefault());
    await user.click(link);
    expect(notice()).toBeNull();
    expect(previewNoticeSeen()).toBe(true);
  });
});

describe('the welcome notice never stacks on another moment', () => {
  it('waits for a bread unlock on Home until it is dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter(true), '/');
    expect(await screen.findByText('Baguette unlocked', {}, SLOW)).toBeTruthy();
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(notice()).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(await findNotice()).toBeTruthy();
  });

  it('goes before the daily quiz popup, which waits until the notice is dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter(), '/');
    await findNotice();
    expect(screen.queryByRole('dialog', { name: 'Daily quiz' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Got it' }));
    expect(await screen.findByRole('dialog', { name: 'Daily quiz' }, SLOW)).toBeTruthy();
    expect(notice()).toBeNull();
  });

  it('never shows two dialogs at once', async () => {
    mount(await homeAdapter(), '/');
    await findNotice();
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
  });
});

describe('Settings: About this preview and Privacy', () => {
  async function settings() {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter(), '/settings');
    // Not part of what is being tested here.
    await user.click(await screen.findByRole('button', { name: 'Got it' }, SLOW));
    await screen.findByRole('heading', { name: 'Settings' }, SLOW);
  }

  it('has an "About this preview" section with the same text and list as the notice', async () => {
    await settings();
    const section = screen.getByRole('heading', { name: 'About this preview' }).closest('section')!;
    expect(within(section).getByText(copy.about.body)).toBeTruthy();
    expect(within(section).getByText('Not here yet:')).toBeTruthy();
    expect(within(section).getAllByRole('listitem').map((li) => li.textContent)).toEqual(copy.about.notHere);
  });

  it('has a Privacy section that says what is stored and how to delete an account', async () => {
    await settings();
    const section = screen.getByRole('heading', { name: 'Privacy' }).closest('section')!;
    expect(section.textContent).toContain('What we store: your email, your quiz answers, the amounts you enter');
    expect(section.textContent).toContain('never sold');
    expect(section.textContent).toContain('email originaldoughmoney@gmail.com');
  });
});

describe('the login screen label', () => {
  it('shows "Early preview" near the wordmark', async () => {
    window.localStorage.setItem(PREVIEW_NOTICE_KEY, '1');
    mount(createMemoryAdapter(), '/login');
    const label = await screen.findByText('Early preview', {}, SLOW);
    expect(label.closest('.login__brand')).toBeTruthy();
  });
});

describe('content/preview.json', () => {
  it('is marked draft and keeps the not-here list in content', () => {
    expect(copy.draft).toBe(true);
    expect(copy.about.notHere.length).toBeGreaterThan(0);
  });

  it('refuses an empty not-here list', () => {
    expect(() => parsePreview({ ...previewJson, about: { ...previewJson.about, notHere: [] } })).toThrow(ContentError);
  });
});
