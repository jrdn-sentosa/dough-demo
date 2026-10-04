import { describe, expect, it } from 'vitest';
import { REOPEN_AFTER_MS, cameToForeground, freshLaunch, spendOpen, wentToBackground } from './appOpen';

const MIN = 60 * 1000;

describe('app opens', () => {
  it('a fresh launch has its one chance', () => {
    expect(freshLaunch()).toEqual({ pending: true, hiddenAt: null });
  });

  it('spending the chance is permanent for that open', () => {
    const spent = spendOpen(freshLaunch());
    expect(spent.pending).toBe(false);
    expect(spendOpen(spent)).toEqual(spent);
  });

  it('30 minutes or more in the background starts a new open when the student is on Home', () => {
    const away = wentToBackground(spendOpen(freshLaunch()), 1000);
    expect(REOPEN_AFTER_MS).toBe(30 * MIN);
    expect(cameToForeground(away, 1000 + 30 * MIN, true).pending).toBe(true);
    expect(cameToForeground(away, 1000 + 3 * 60 * MIN, true).pending).toBe(true);
  });

  it('less than 30 minutes away is the same open', () => {
    const away = wentToBackground(spendOpen(freshLaunch()), 1000);
    expect(cameToForeground(away, 1000 + 30 * MIN - 1, true).pending).toBe(false);
  });

  it('a short trip does not give back a chance that is still unused, or take it away', () => {
    const away = wentToBackground(freshLaunch(), 0);
    expect(cameToForeground(away, 5 * MIN, true).pending).toBe(true);
  });

  it('coming back to another screen never starts an open, so going Home later shows nothing', () => {
    const away = wentToBackground(spendOpen(freshLaunch()), 0);
    expect(cameToForeground(away, 45 * MIN, false).pending).toBe(false);
  });

  it('measures from when the app first went to the background, not from repeated hidden events', () => {
    let state = wentToBackground(spendOpen(freshLaunch()), 0);
    state = wentToBackground(state, 25 * MIN);
    expect(cameToForeground(state, 31 * MIN, true).pending).toBe(true);
  });
});
