// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { saveHabit, setHysaCard } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { advance } from '../money/clock';
import { addStarting, startLoaf } from '../money/ledger';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setVisibility('visible');
});

const EF = 'emergency-fund';
const dollars = (n: number) => n * 100;
const SLOW = { timeout: 5000 };

interface Setup {
  /// Best quiz score of 5. 4 or more means the lessons are mastered, which is what opens the daily quiz.
  quiz?: number;
  hysaCard?: 'pending' | null;
  /** An unlock the student hasn't dismissed yet. */
  unseenUnlock?: boolean;
}

function attempt(score: number): QuizAttempt {
  return { id: 'quiz-1', loafId: EF, mode: 'lesson', score, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };
}

/** A returning student on Home with $240 of a $400 loaf. */
async function homeAdapter(setup: Setup = {}): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user: { email: 'a@b.co' },
    profile: profileFromAnswers({ essentials: '250-499', accounts: ['checking'], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [attempt(setup.quiz ?? 4)],
  });
  await startLoaf(adapter, EF, dollars(400));
  await addStarting(adapter, EF, dollars(240));
  await saveHabit(adapter, { kind: 'weekly', amountCents: dollars(35) });
  if (setup.hysaCard) await setHysaCard(adapter, setup.hysaCard);
  if (setup.unseenUnlock) {
    const data = await adapter.load();
    data.streaks.unlocked = [{ bread: 'baguette', at: '2026-01-01T00:00:00.000Z', seen: false }];
    await adapter.save(data);
  }
  return adapter;
}

/** Each mount is a fresh app launch: the app shell, and so the "app open", starts over. */
function mount(adapter: DataAdapter, path = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return { router, pathname: () => router.state.location.pathname };
}

const popup = () => screen.queryByRole('dialog', { name: 'Daily quiz' });
const findPopup = () => screen.findByRole('dialog', { name: 'Daily quiz' }, SLOW);
const homeReady = () => screen.findByRole('link', { name: /Dough points/ }, SLOW);

/** Waits until Home has loaded, then checks the popup isn't there. */
async function expectNoPopup() {
  await homeReady();
  // Give anything that is going to show a moment to do so.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50));
  });
  expect(popup()).toBeNull();
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
}

function changeVisibility(state: 'visible' | 'hidden') {
  setVisibility(state);
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('the daily quiz popup', () => {
  it("opens on a fresh launch while today's quiz is waiting, with the copy and its options", async () => {
    mount(await homeAdapter());
    const dialog = await findPopup();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain(
      "Daily quiz: 3 quick questions from lessons you've mastered. Finish for 1 point, and get all 3 right for 1 extra.",
    );
    for (const name of ['Start', 'Not now', "Don't show this again"]) {
      expect(screen.getByRole('button', { name })).toBeTruthy();
    }
    const hide = screen.getByRole('checkbox', { name: 'Hide for today' }) as HTMLInputElement;
    expect(hide.checked).toBe(false);
  });

  it('stays away until a module is mastered', async () => {
    mount(await homeAdapter({ quiz: 3 }));
    await expectNoPopup();
  });

  it("stays away once today's quiz is finished", async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    const { router } = mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Start' }, SLOW));
    await waitFor(() => expect(router.state.location.pathname).toBe('/daily-quiz'));
    // Answer all three, whatever is picked.
    for (let i = 0; i < 3; i++) {
      await user.click((await screen.findAllByRole('radio', {}, SLOW))[0]);
      await user.click(screen.getByRole('button', { name: 'Check answer' }));
      await user.click(await screen.findByRole('button', { name: i < 2 ? 'Next question' : 'See how it went' }, SLOW));
    }
    cleanup();
    mount(adapter);
    await expectNoPopup();
  });

  it('"Start" opens the daily quiz', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await homeAdapter());
    await user.click(await screen.findByRole('button', { name: 'Start' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/daily-quiz'));
    expect(await screen.findByText('Question 1 of 3', { selector: 'p' }, SLOW)).toBeTruthy();
  });

  it('"Not now" closes it, and Escape does too', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter());
    await findPopup();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(popup()).toBeNull();
    cleanup();

    mount(await homeAdapter());
    await findPopup();
    await user.keyboard('{Escape}');
    expect(popup()).toBeNull();
  });

  it('"Not now" only closes it until the next time the app opens', async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await user.click(await screen.findByRole('button', { name: 'Not now' }, SLOW));
    expect(popup()).toBeNull();
    // Nothing was saved: it isn't hidden, only closed for now.
    expect((await adapter.load()).dailyQuizPopup).toEqual({ off: false, hiddenDay: null });
    cleanup();
    mount(adapter);
    expect(await findPopup()).toBeTruthy();
  });

  it('"Hide for today" keeps it away for the rest of the day, and it is back the next day (demo clock)', async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await findPopup();
    await user.click(screen.getByRole('checkbox', { name: 'Hide for today' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(popup()).toBeNull();
    await waitFor(async () => expect((await adapter.load()).dailyQuizPopup.hiddenDay).not.toBeNull());
    cleanup();

    mount(adapter);
    await expectNoPopup();
    cleanup();

    await advance(adapter, 1);
    mount(adapter);
    expect(await findPopup()).toBeTruthy();
  });

  it('"Hide for today" only counts when the popup is closed with it checked', async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await findPopup();
    await user.click(screen.getByRole('checkbox', { name: 'Hide for today' }));
    await user.click(screen.getByRole('checkbox', { name: 'Hide for today' }));
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect((await adapter.load()).dailyQuizPopup.hiddenDay).toBeNull();
  });

  it('"Hide for today" also counts when the quiz is started from the popup', async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter);
    await findPopup();
    await user.click(screen.getByRole('checkbox', { name: 'Hide for today' }));
    await user.click(screen.getByRole('button', { name: 'Start' }));
    await waitFor(() => expect(pathname()).toBe('/daily-quiz'));
    expect((await adapter.load()).dailyQuizPopup.hiddenDay).not.toBeNull();
  });

  it('"Don\'t show this again" turns it off for good, and the Settings switch turns it back on', async () => {
    const adapter = await homeAdapter();
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await findPopup();
    await user.click(screen.getByRole('button', { name: "Don't show this again" }));
    expect(popup()).toBeNull();
    await waitFor(async () => expect((await adapter.load()).dailyQuizPopup.off).toBe(true));
    cleanup();

    // Off for good: not at the next launch, and not on a later day.
    mount(adapter);
    await expectNoPopup();
    cleanup();
    await advance(adapter, 3);
    mount(adapter);
    await expectNoPopup();
    cleanup();

    // The Settings switch shows it as off, and turning it on brings the popup back.
    const { router } = mount(adapter, '/settings');
    const toggle = (await screen.findByRole('switch', { name: 'Show the daily quiz popup' }, SLOW)) as HTMLInputElement;
    expect(toggle.checked).toBe(false);
    await user.click(toggle);
    await waitFor(async () => expect((await adapter.load()).dailyQuizPopup.off).toBe(false));
    expect(toggle.checked).toBe(true);
    cleanup();
    mount(adapter);
    expect(await findPopup()).toBeTruthy();
    expect(router).toBeTruthy();
  });

  it('has the Settings switch on by default', async () => {
    mount(await homeAdapter(), '/settings');
    const toggle = (await screen.findByRole('switch', { name: 'Show the daily quiz popup' }, SLOW)) as HTMLInputElement;
    expect(toggle.checked).toBe(true);
  });

  it('says nothing about skipping: no guilt in the popup', async () => {
    mount(await homeAdapter());
    const dialog = await findPopup();
    expect(dialog.textContent).not.toMatch(/miss|skip|streak|behind|lost|fail|don't forget|hurry/i);
  });
});

describe('once per app open', () => {
  it('never shows when the student navigates back to Home from another screen', async () => {
    // A reminder is blocking the popup at launch, so its one chance for this open is still unused.
    const adapter = await homeAdapter({ hysaCard: 'pending' });
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(adapter);
    await user.click(await homeReady());
    await waitFor(() => expect(pathname()).toBe('/points'));
    await user.click(await screen.findByRole('button', { name: 'Back to Home' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/'));
    await homeReady();
    await user.click(screen.getByRole('button', { name: 'Dismiss this reminder' }));
    await expectNoPopup();
  });

  it("a launch on another screen spends the open, so going Home later shows nothing", async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await homeAdapter(), '/settings');
    await user.click(await screen.findByRole('link', { name: 'Back to my loaf' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/'));
    await expectNoPopup();
  });

  it('coming back from the quiz without finishing does not bring it back', async () => {
    const user = userEvent.setup({ delay: null });
    const { pathname } = mount(await homeAdapter());
    await user.click(await screen.findByRole('button', { name: 'Start' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/daily-quiz'));
    await user.click(await screen.findByRole('button', { name: 'Back to Home' }, SLOW));
    await waitFor(() => expect(pathname()).toBe('/'));
    await expectNoPopup();
  });

  describe('coming back to the foreground', () => {
    beforeEach(() => {
      // Only the clock is faked, so the app's timers and the test's waiting keep working.
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 5, 9, 0, 0));
    });

    async function closedOnHome() {
      const user = userEvent.setup({ delay: null });
      const adapter = await homeAdapter();
      const mounted = mount(adapter);
      await user.click(await screen.findByRole('button', { name: 'Not now' }, SLOW));
      expect(popup()).toBeNull();
      return { user, adapter, ...mounted };
    }

    it('after at least 30 minutes in the background, shows it again on Home', async () => {
      await closedOnHome();
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 9, 30, 0));
      changeVisibility('visible');
      expect(await findPopup()).toBeTruthy();
    });

    it('after less than 30 minutes, does not', async () => {
      await closedOnHome();
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 9, 29, 59));
      changeVisibility('visible');
      await expectNoPopup();
    });

    it('counts the time from when the app first went to the background', async () => {
      await closedOnHome();
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 9, 20, 0));
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 9, 31, 0));
      changeVisibility('visible');
      expect(await findPopup()).toBeTruthy();
    });

    it('does not show when the app comes back on another screen, nor when the student goes Home afterwards', async () => {
      const { user, pathname } = await closedOnHome();
      await user.click(await homeReady());
      await waitFor(() => expect(pathname()).toBe('/points'));
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 10, 30, 0));
      changeVisibility('visible');
      await user.click(await screen.findByRole('button', { name: 'Back to Home' }, SLOW));
      await waitFor(() => expect(pathname()).toBe('/'));
      await expectNoPopup();
    });

    it('still respects "Don\'t show this again" and "Hide for today"', async () => {
      const { user } = await closedOnHome();
      // Hide for today, then come back after a long time on the same day.
      cleanup();
      const adapter = await homeAdapter();
      mount(adapter);
      await findPopup();
      await user.click(screen.getByRole('checkbox', { name: 'Hide for today' }));
      await user.click(screen.getByRole('button', { name: 'Not now' }));
      await waitFor(async () => expect((await adapter.load()).dailyQuizPopup.hiddenDay).not.toBeNull());
      changeVisibility('hidden');
      vi.setSystemTime(new Date(2026, 9, 5, 12, 0, 0));
      changeVisibility('visible');
      await expectNoPopup();
    });
  });
});

describe('never stacks on another moment', () => {
  it('waits for a bread unlock until it is dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter({ unseenUnlock: true }));
    expect(await screen.findByText('Baguette unlocked', {}, SLOW)).toBeTruthy();
    await expectNoPopup();
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(await findPopup()).toBeTruthy();
    expect(screen.queryByText('Baguette unlocked')).toBeNull();
  });

  it('waits for the high-yield savings reminder until it is dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await homeAdapter({ hysaCard: 'pending' }));
    await screen.findByRole('button', { name: 'Dismiss this reminder' }, SLOW);
    await expectNoPopup();
    await user.click(screen.getByRole('button', { name: 'Dismiss this reminder' }));
    expect(await findPopup()).toBeTruthy();
  });

  it('waits for a stage-change message until it is dismissed', async () => {
    const adapter = await homeAdapter({ unseenUnlock: true });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Baguette unlocked', {}, SLOW);
    // $240 + $60 reaches 75% of $400, so the loaf is now baking.
    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    const amount = screen.getByLabelText('How much did you move to savings?');
    await user.clear(amount);
    await user.type(amount, '60');
    await user.click(screen.getByRole('button', { name: 'I moved $60 to savings' }));
    expect(await screen.findByText(/Your loaf is now/, {}, SLOW)).toBeTruthy();
    // The unlock goes first, but the message is still up, so the popup keeps waiting.
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await expectNoPopup();
    await user.click(screen.getByRole('button', { name: 'Dismiss message' }));
    expect(await findPopup()).toBeTruthy();
  });

  it('waits for the message after using the fund until it is dismissed', async () => {
    const adapter = await homeAdapter({ unseenUnlock: true });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Baguette unlocked', {}, SLOW);
    await user.click(screen.getByRole('button', { name: 'Use my fund' }));
    await user.type(screen.getByLabelText('How much do you need?'), '10');
    await user.click(screen.getByRole('button', { name: 'Use $10 from my fund' }));
    const dismiss = await screen.findByRole('button', { name: 'Dismiss message' }, SLOW);
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await expectNoPopup();
    await user.click(dismiss);
    expect(await findPopup()).toBeTruthy();
  });

  it('does not open over the amount sheet', async () => {
    const adapter = await homeAdapter({ unseenUnlock: true });
    const user = userEvent.setup({ delay: null });
    mount(adapter);
    await screen.findByText('Baguette unlocked', {}, SLOW);
    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    await user.click(screen.getByRole('button', { name: 'Dismiss' }));
    await expectNoPopup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await findPopup()).toBeTruthy();
  });

  it('a deposit that bakes the loaf goes to the celebration with no popup, and none when back on Home', async () => {
    const adapter = await homeAdapter({ hysaCard: 'pending' });
    const user = userEvent.setup({ delay: null });
    const { router, pathname } = mount(adapter);
    await screen.findByRole('button', { name: 'Dismiss this reminder' }, SLOW);
    await user.click(screen.getByRole('button', { name: 'Add to my loaf' }));
    const amount = screen.getByLabelText('How much did you move to savings?');
    await user.clear(amount);
    await user.type(amount, '160');
    await user.click(screen.getByRole('button', { name: 'I moved $160 to savings' }));
    await waitFor(() => expect(pathname()).toBe('/loaf-complete'), SLOW);
    expect(popup()).toBeNull();

    await act(async () => {
      await router.navigate('/');
    });
    await expectNoPopup();
  });
});
