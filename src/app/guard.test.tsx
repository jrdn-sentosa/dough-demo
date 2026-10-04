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
const returning: AppData = { ...noLoaf, loaves: [loaf] };

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
    expect(guardRedirect('/choose-loaf', returning)).toBeNull();
  });

  it('sends a student whose fund started baked on to choose the next loaf', () => {
    const baked: AppData = { ...noLoaf, loaves: [{ ...loaf, bakes: [{ targetCents: 65000, at: null }] }] };
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
    await screen.findByRole('heading', { name: 'Dough!' });
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
