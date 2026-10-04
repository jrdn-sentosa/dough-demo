// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import type { AppData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { DataProvider } from './DataProvider';
import { guardRedirect } from './guard';
import { routes } from './router';

afterEach(cleanup);

const user = { email: 'a@b.co' };
const profile = profileFromAnswers({ essentials: '500-749' });
const loaf = { loafId: 'emergency-fund' as const, targetCents: 65000, startedAt: '2026-01-01T00:00:00.000Z', bakes: [], growFromCents: null };

const signedOut = emptyData();
const noProfile: AppData = { ...emptyData(), user };
const noLoaf: AppData = { ...noProfile, profile };
const quizDone = { id: 'quiz-1', loafId: 'emergency-fund' as const, mode: 'lesson' as const, score: 2, total: 5, answers: {}, missedLessons: [], at: '2026-01-02T00:00:00.000Z' };
const midFlow: AppData = { ...noLoaf, loaves: [loaf] };
const habit = { kind: 'weekly' as const, amountCents: 5500, paycheckCents: null, frequency: null, startedAt: '2026-01-03T00:00:00.000Z' };
/** Lessons done but no habit picked yet. */
const quizzed: AppData = { ...midFlow, quizAttempts: [quizDone] };
const returning: AppData = { ...quizzed, habit };

describe('guardRedirect', () => {
  it('sends signed-out students to login from everywhere', () => {
    for (const path of ['/', '/placement', '/placement/result', '/new-loaf', '/choose-loaf']) {
      expect(guardRedirect(path, signedOut)).toBe('/login');
    }
    expect(guardRedirect('/login', signedOut)).toBeNull();
  });

  it('walks first-time students through the steps in order', () => {
    expect(guardRedirect('/login', noProfile)).toBe('/placement');
    expect(guardRedirect('/', noProfile)).toBe('/placement');
    expect(guardRedirect('/new-loaf', noProfile)).toBe('/placement');
    expect(guardRedirect('/placement', noProfile)).toBeNull();

    expect(guardRedirect('/', noLoaf)).toBe('/placement/result');
    expect(guardRedirect('/login', noLoaf)).toBe('/placement/result');
    expect(guardRedirect('/new-loaf', noLoaf)).toBeNull();
  });

  it('lands returning students on Home and keeps them out of the first-time screens', () => {
    expect(guardRedirect('/login', returning)).toBe('/');
    expect(guardRedirect('/placement', returning)).toBe('/');
    expect(guardRedirect('/new-loaf', returning)).toBe('/');
    expect(guardRedirect('/', returning)).toBeNull();
    // Nothing is baked yet, so there is nothing to celebrate, shelve or choose after.
    expect(guardRedirect('/choose-loaf', returning)).toBe('/');
  });

  it('keeps a new loaf on its lessons until the quiz is done', () => {
    expect(guardRedirect('/', midFlow)).toBe('/lessons');
    expect(guardRedirect('/new-loaf', midFlow)).toBe('/lessons');
    expect(guardRedirect('/saving-setup', midFlow)).toBe('/lessons');
    expect(guardRedirect('/lessons', midFlow)).toBeNull();
    expect(guardRedirect('/lessons/ef-how-much', midFlow)).toBeNull();
    expect(guardRedirect('/quiz', midFlow)).toBeNull();
  });

  it('a failed test-out does not unlock saving setup, but a passing one does', () => {
    const attempt = (score: number) => ({ ...quizDone, mode: 'test-out' as const, score });
    expect(guardRedirect('/saving-setup', { ...midFlow, quizAttempts: [attempt(3)] })).toBe('/lessons');
    expect(guardRedirect('/', { ...midFlow, quizAttempts: [attempt(3)] })).toBe('/lessons');
    expect(guardRedirect('/saving-setup', { ...midFlow, quizAttempts: [attempt(4)] })).toBeNull();
    expect(guardRedirect('/', { ...midFlow, quizAttempts: [attempt(4)] })).toBe('/saving-setup');
  });

  it('opens saving setup after a normal quiz at any score', () => {
    expect(guardRedirect('/saving-setup', returning)).toBeNull();
  });

  it('holds Home at saving setup until a habit is picked, then lets Home show', () => {
    expect(guardRedirect('/', quizzed)).toBe('/saving-setup');
    expect(guardRedirect('/saving-setup', quizzed)).toBeNull();
    expect(guardRedirect('/', returning)).toBeNull();
    // Saving setup stays open once a habit exists, so the last step (Make it automatic) isn't cut off.
    expect(guardRedirect('/saving-setup', returning)).toBeNull();
  });

  it('does not hold a fund that has already baked at saving setup', () => {
    const baked: AppData = { ...quizzed, loaves: [{ ...loaf, bakes: [{ targetCents: 65000, at: '2026-02-01T00:00:00.000Z' }] }] };
    expect(guardRedirect('/', baked)).toBeNull();
  });

  describe('after a bake', () => {
    const tx = (type: 'starting' | 'deposit' | 'withdrawal', amountCents: number, n: number) => ({
      id: `tx-${n}`,
      loafId: 'emergency-fund' as const,
      type,
      source: 'manual' as const,
      amountCents,
      at: '2026-02-01T00:00:00.000Z',
    });
    const bake = { targetCents: 65000, at: '2026-02-01T00:00:00.000Z' };
    /** Baked and sitting at its target. */
    const baked: AppData = { ...quizzed, habit, loaves: [{ ...loaf, bakes: [bake] }], transactions: [tx('deposit', 65000, 1)] };
    const withRisk = (d: AppData): AppData => ({
      ...d,
      profile: { ...profile, risk: { status: 'complete', answers: {}, result: { keepSavings: false, approach: 'steady', loaf: 'bonds', where: null, startSmall: true } } },
    });

    it('opens the celebration, shelf and choices for a loaf that is baked and at its target', () => {
      for (const path of ['/loaf-complete', '/shelf', '/choose-loaf', '/risk-quiz']) expect(guardRedirect(path, baked)).toBeNull();
    });

    it('keeps all of them away from a loaf that has not baked', () => {
      for (const path of ['/loaf-complete', '/shelf', '/choose-loaf', '/risk-quiz', '/risk-result']) {
        expect(guardRedirect(path, { ...quizzed, habit })).toBe('/');
      }
    });

    it('needs a loaf at all', () => {
      for (const path of ['/loaf-complete', '/shelf', '/choose-loaf', '/risk-quiz', '/risk-result']) {
        expect(guardRedirect(path, noLoaf)).toBe('/placement/result');
      }
    });

    it('keeps the shelf open while rebuilding or growing, but not the choices', () => {
      const rebuilding: AppData = { ...baked, transactions: [...baked.transactions, tx('withdrawal', 30000, 2)] };
      expect(guardRedirect('/shelf', rebuilding)).toBeNull();
      expect(guardRedirect('/loaf-complete', rebuilding)).toBeNull();
      expect(guardRedirect('/choose-loaf', rebuilding)).toBe('/');
      expect(guardRedirect('/risk-quiz', rebuilding)).toBe('/');
      const growing: AppData = { ...baked, loaves: [{ ...loaf, targetCents: 195000, growFromCents: 65000, bakes: [bake] }] };
      expect(guardRedirect('/shelf', growing)).toBeNull();
      expect(guardRedirect('/choose-loaf', growing)).toBe('/');
    });

    it('shows the risk result only once the quiz has been taken or skipped', () => {
      expect(guardRedirect('/risk-result', baked)).toBe('/choose-loaf');
      expect(guardRedirect('/risk-result', withRisk(baked))).toBeNull();
    });

    it('lets a student with a loaf reopen placement to retake it, and only then', () => {
      expect(guardRedirect('/placement', baked)).toBe('/');
      expect(guardRedirect('/placement', baked, '?retake=1&return=/choose-loaf')).toBeNull();
      expect(guardRedirect('/placement', baked, '?retake=0')).toBe('/');
      expect(guardRedirect('/placement', noLoaf, '')).toBeNull();
    });
  });

  it('keeps lessons and the quiz behind a loaf', () => {
    for (const path of ['/lessons', '/lessons/ef-how-much', '/quiz', '/saving-setup', '/loaf-complete']) {
      expect(guardRedirect(path, noLoaf)).toBe('/placement/result');
    }
  });

  it('sends a student whose fund started baked on to choose the next loaf', () => {
    const baked: AppData = {
      ...noLoaf,
      loaves: [{ ...loaf, bakes: [{ targetCents: 65000, at: null }] }],
      transactions: [{ id: 'tx-1', loafId: 'emergency-fund', type: 'starting', source: 'manual', amountCents: 70000, at: '2026-01-01T00:00:00.000Z' }],
    };
    expect(guardRedirect('/new-loaf', baked)).toBe('/choose-loaf');
    expect(guardRedirect('/choose-loaf', baked)).toBeNull();
  });
});

function renderAt(path: string, data: AppData) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <DataProvider adapter={createMemoryAdapter(data)}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return router;
}

describe('route guard in the app', () => {
  it('shows login to a signed-out student', async () => {
    const router = renderAt('/', signedOut);
    expect(await screen.findByRole('button', { name: 'Continue with email' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the placement quiz to a signed-in student with no profile', async () => {
    const router = renderAt('/', noProfile);
    expect(await screen.findByRole('progressbar')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/placement');
  });

  it('shows the result to a student who answered placement but has no loaf', async () => {
    const router = renderAt('/', noLoaf);
    expect(await screen.findByRole('heading', { name: "Here's where you'll start" })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/placement/result');
  });

  it('sends a returning student on Home', async () => {
    const router = renderAt('/login', returning);
    await screen.findByRole('heading', { name: 'Emergency fund' });
    expect(router.state.location.pathname).toBe('/');
  });
});

describe('login screen', () => {
  it('has no Google, Apple, or School button, and shows the demo option and disclaimer', async () => {
    renderAt('/login', signedOut);
    await screen.findByRole('button', { name: 'Continue with email' });
    expect(screen.getByRole('button', { name: 'Continue as demo user' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /google|apple|school/i })).toBeNull();
    expect(document.body.textContent).toContain('Educational demo. Not financial advice.');
    expect(document.body.textContent).toContain('No real money moves.');
  });
});
