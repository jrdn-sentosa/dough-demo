// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { QuizAttempt } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { deposit, startLoaf } from '../money/ledger';
import { renderCard } from '../share/renderCard';

vi.mock('../share/renderCard', () => ({ renderCard: vi.fn(async () => new Blob(['png'], { type: 'image/png' })) }));

const render_ = vi.mocked(renderCard);

beforeEach(() => {
  render_.mockClear();
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: () => 'blob:preview', revokeObjectURL: () => {} }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'share');
  Reflect.deleteProperty(navigator, 'canShare');
});

const EF = 'emergency-fund';
const attempt = (score: number): QuizAttempt => ({ id: 'q1', loafId: EF, mode: 'lesson', score, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' });

/** A baked fund with a big, easy-to-spot balance, so any leak of it into the card would show. */
async function bakedAdapter(mastered: boolean, user: { email: string } = { email: 'a@b.co' }): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user,
    profile: profileFromAnswers({ essentials: '1500-plus', accounts: ['checking'], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [attempt(mastered ? 4 : 2)],
  });
  await startLoaf(adapter, EF, 987_654);
  await saveHabit(adapter, { kind: 'weekly', amountCents: 5_000 });
  await deposit(adapter, EF, 987_654);
  return adapter;
}

function mount(adapter: DataAdapter) {
  const router = createMemoryRouter(routes, { initialEntries: ['/loaf-complete'] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
}

function stubShare(share: ReturnType<typeof vi.fn>, canShare = true) {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  Object.defineProperty(navigator, 'canShare', { value: () => canShare, configurable: true });
}

describe('Share on the celebration screen', () => {
  it('opens a sheet that makes the picture with the bread, the golden finish when mastered, and nothing about money', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(true));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    await screen.findByRole('dialog', { name: 'Share your win' });
    await waitFor(() => expect(render_).toHaveBeenCalled());

    const request = render_.mock.calls[0][0];
    expect(request).toEqual({
      size: 'story',
      content: { headline: 'I just baked my emergency fund loaf', tagline: 'Stack that bread.', address: window.location.host },
      bread: 'sandwich',
      mastered: true,
    });
    // The fund is $9,876.54: none of its digits, and no dollar sign, can be anywhere in the request.
    expect(JSON.stringify(request)).not.toMatch(/\$|9,?876|54/);
    expect(screen.getByRole('dialog').textContent).not.toMatch(/\$|9,?876/);
  });

  it('has no golden finish when the lessons are not mastered', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(false));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    await waitFor(() => expect(render_).toHaveBeenCalled());
    expect(render_.mock.calls[0][0].mastered).toBe(false);
  });

  it('draws the other shape when the student picks Post', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(true));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    await user.click(await screen.findByRole('radio', { name: 'Post (square)' }));
    await waitFor(() => expect(render_.mock.calls.some(([r]) => r.size === 'post')).toBe(true));
  });

  it('works for an account as well as the demo user, and sends the picture to the share sheet', async () => {
    for (const user of [{ email: 'maya@demo.local' }, { email: 'real@account.co' }]) {
      const share = vi.fn(async () => {});
      stubShare(share);
      const u = userEvent.setup({ delay: null });
      mount(await bakedAdapter(true, user));
      await u.click(await screen.findByRole('button', { name: 'Share' }));
      const send = await screen.findByRole('button', { name: 'Share picture' });
      await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
      await u.click(send);
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
      const data = (share.mock.calls[0] as unknown as [ShareData])[0];
      expect(data.files?.[0].name).toBe('dough-baked-story.png');
      expect(data.text).not.toMatch(/\$|9,?876/);
      cleanup();
    }
  });

  it('saves the picture and says so when the device has no share sheet', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(true));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    const send = await screen.findByRole('button', { name: 'Share picture' });
    await waitFor(() => expect((send as HTMLButtonElement).disabled).toBe(false));
    await user.click(send);
    await screen.findByText('Your picture was saved to this device. You can post it from there.');
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('copies the text, which holds the line, the tagline and the link and nothing about money', async () => {
    // userEvent.setup() installs its own clipboard stand-in, so read back what was copied.
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(true));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    await user.click(await screen.findByRole('button', { name: 'Copy text' }));
    await screen.findByText('Copied. You can paste it anywhere.');
    const copied = await navigator.clipboard.readText();
    expect(copied).toBe(`I just baked my emergency fund loaf\nStack that bread.\n${window.location.origin}/`);
    expect(copied).not.toMatch(/\$|9,?876/);
  });

  it('closes with the Close button', async () => {
    const user = userEvent.setup({ delay: null });
    mount(await bakedAdapter(true));
    await user.click(await screen.findByRole('button', { name: 'Share' }));
    await user.click(await screen.findByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
