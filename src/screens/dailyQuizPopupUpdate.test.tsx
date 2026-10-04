// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import type { DataAdapter } from '../data/adapter';
import { saveHabit } from '../data/habit';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { addStarting, startLoaf } from '../money/ledger';

// A new version is always waiting in this file, so the "New version available" banner is on screen.
vi.mock('../app/serviceWorker', () => ({
  registerServiceWorker: async (onNeedRefresh: () => void) => {
    onNeedRefresh();
    return () => undefined;
  },
}));

afterEach(cleanup);

const EF = 'emergency-fund';
const SLOW = { timeout: 5000 };

async function homeAdapter(): Promise<DataAdapter> {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user: { email: 'a@b.co' },
    profile: profileFromAnswers({ essentials: '250-499', accounts: ['checking', 'regular-savings'], cardDebt: 'no', earnedIncome: true }),
    quizAttempts: [{ id: 'quiz-1', loafId: EF, mode: 'lesson', score: 4, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' }],
  });
  await startLoaf(adapter, EF, 40_000);
  await addStarting(adapter, EF, 24_000);
  await saveHabit(adapter, { kind: 'weekly', amountCents: 3_500 });
  return adapter;
}

describe('the daily quiz popup and the update banner', () => {
  it('waits while "New version available" is showing, and opens once it is dismissed', async () => {
    const user = userEvent.setup({ delay: null });
    const router = createMemoryRouter(routes, { initialEntries: ['/'] });
    render(
      <DataProvider adapter={await homeAdapter()}>
        <RouterProvider router={router} />
      </DataProvider>,
    );
    expect(await screen.findByText('New version available', {}, SLOW)).toBeTruthy();
    await screen.findByRole('link', { name: /Dough points/ }, SLOW);
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(screen.queryByRole('dialog', { name: 'Daily quiz' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(screen.queryByText('New version available')).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'Daily quiz' }, SLOW)).toBeTruthy();
  });
});
