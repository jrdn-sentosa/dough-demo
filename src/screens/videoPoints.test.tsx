// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DataProvider } from '../app/DataProvider';
import { routes } from '../app/router';
import { getLessons } from '../content/loader';
import { createMemoryAdapter } from '../data/memoryAdapter';
import { emptyData } from '../data/types';
import { profileFromAnswers } from '../domain/profile';
import { resetVideoProbe } from './videoAvailable';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  resetVideoProbe();
});

const lesson = getLessons('emergency-fund')[0];

function mount() {
  const adapter = createMemoryAdapter({
    ...emptyData(),
    user: { email: 'a@b.co' },
    profile: profileFromAnswers({ accounts: ['checking'] }),
    loaves: [{ loafId: 'emergency-fund', targetCents: 65_000, startedAt: '2026-01-01T00:00:00.000Z', bread: 'sandwich', bakes: [], growFromCents: null }],
  });
  const router = createMemoryRouter(routes, { initialEntries: [`/lessons/${lesson.id}`] });
  render(
    <DataProvider adapter={adapter}>
      <RouterProvider router={router} />
    </DataProvider>,
  );
  return adapter;
}

/** A video that is 100 seconds long, with the given stretches played and the playhead at `currentTime`. */
function setVideo(video: HTMLVideoElement, currentTime: number, ...played: [number, number][]) {
  Object.defineProperty(video, 'duration', { value: 100, configurable: true });
  Object.defineProperty(video, 'currentTime', { value: currentTime, configurable: true });
  Object.defineProperty(video, 'played', {
    configurable: true,
    value: { length: played.length, start: (i: number) => played[i][0], end: (i: number) => played[i][1] },
  });
}

const videoKeys = async (adapter: ReturnType<typeof mount>) =>
  (await adapter.load()).points.filter((p) => p.kind === 'video').map((p) => p.key);

describe('video points', () => {
  it('are earned once, when 90% of the video has actually been played', async () => {
    const adapter = mount();
    await screen.findByRole('heading', { name: lesson.title });
    const video = document.querySelector('video') as HTMLVideoElement;

    setVideo(video, 80, [0, 80]);
    fireEvent.timeUpdate(video);
    expect(await videoKeys(adapter)).toEqual([]);

    setVideo(video, 91, [0, 91]);
    fireEvent.timeUpdate(video);
    await waitFor(async () => expect(await videoKeys(adapter)).toEqual([`video:${lesson.id}`]));

    fireEvent.timeUpdate(video);
    fireEvent.ended(video);
    expect(await videoKeys(adapter)).toEqual([`video:${lesson.id}`]);
    expect((await adapter.load()).points).toHaveLength(1);
  });

  it('are not earned by skipping ahead, though the lesson still counts as watched', async () => {
    const adapter = mount();
    await screen.findByRole('heading', { name: lesson.title });
    const video = document.querySelector('video') as HTMLVideoElement;

    // Played the first 10 seconds, then jumped to 95.
    setVideo(video, 95, [0, 10], [95, 96]);
    fireEvent.timeUpdate(video);
    await waitFor(async () => expect((await adapter.load()).lessonProgress).toHaveLength(1));
    expect(await videoKeys(adapter)).toEqual([]);
    fireEvent.ended(video);
    expect(await videoKeys(adapter)).toEqual([]);
  });

  it('are not earned by "Mark as watched"', async () => {
    const user = userEvent.setup();
    const adapter = mount();
    await user.click(await screen.findByRole('button', { name: 'Mark as watched' }));
    await waitFor(async () => expect((await adapter.load()).lessonProgress).toHaveLength(1));
    expect(await videoKeys(adapter)).toEqual([]);
    expect((await adapter.load()).points).toEqual([]);
  });

  it('are not earned from the "Video coming soon" poster', async () => {
    const adapter = mount();
    await screen.findByRole('heading', { name: lesson.title });
    fireEvent.error(document.querySelector('video') as HTMLVideoElement);
    expect(await screen.findByText('Video coming soon')).toBeTruthy();
    expect((await adapter.load()).points).toEqual([]);
  });
});
