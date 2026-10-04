// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { copyShareText, shareCard } from './shareImage';
import type { ShareEnv } from './shareImage';

const blob = new Blob(['png'], { type: 'image/png' });
const request = { blob, fileName: 'dough-baked-story.png', text: 'I just baked my emergency fund loaf\nStack that bread.' };

function env(overrides: Partial<ShareEnv> = {}): ShareEnv & { download: ReturnType<typeof vi.fn>; copyFallback: ReturnType<typeof vi.fn> } {
  return { download: vi.fn(), copyFallback: vi.fn(() => true), ...overrides } as never;
}

describe('shareCard', () => {
  it('hands the image to the share sheet when the device can send files', async () => {
    const share = vi.fn(async () => {});
    const e = env({ share, canShare: () => true });
    expect(await shareCard(request, e)).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    const data = (share.mock.calls[0] as unknown as [ShareData])[0];
    expect(data.files).toHaveLength(1);
    expect(data.files?.[0].name).toBe('dough-baked-story.png');
    expect(data.files?.[0].type).toBe('image/png');
    expect(data.text).toBe(request.text);
    expect(e.download).not.toHaveBeenCalled();
  });

  it('downloads when there is no share sheet', async () => {
    const e = env();
    expect(await shareCard(request, e)).toBe('downloaded');
    expect(e.download).toHaveBeenCalledWith(blob, 'dough-baked-story.png');
  });

  it('downloads when the share sheet cannot take files', async () => {
    const share = vi.fn(async () => {});
    const e = env({ share, canShare: () => false });
    expect(await shareCard(request, e)).toBe('downloaded');
    expect(share).not.toHaveBeenCalled();
    expect(e.download).toHaveBeenCalledTimes(1);
  });

  it('downloads when canShare is missing', async () => {
    const e = env({ share: vi.fn(async () => {}) });
    expect(await shareCard(request, e)).toBe('downloaded');
  });

  it('closing the share sheet is quiet: nothing is downloaded', async () => {
    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    const e = env({ share: vi.fn(async () => Promise.reject(abort)), canShare: () => true });
    expect(await shareCard(request, e)).toBe('cancelled');
    expect(e.download).not.toHaveBeenCalled();
  });

  it('any other share failure falls back to saving the picture', async () => {
    const denied = Object.assign(new Error('needs a tap'), { name: 'NotAllowedError' });
    const e = env({ share: vi.fn(async () => Promise.reject(denied)), canShare: () => true });
    expect(await shareCard(request, e)).toBe('downloaded');
    expect(e.download).toHaveBeenCalledWith(blob, 'dough-baked-story.png');
  });
});

describe('copyShareText', () => {
  it('uses the clipboard', async () => {
    const writeText = vi.fn(async () => {});
    const e = env({ writeText });
    expect(await copyShareText('hello', e)).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
    expect(e.copyFallback).not.toHaveBeenCalled();
  });

  it('falls back to the text-field copy when the clipboard is missing or refuses', async () => {
    const none = env();
    expect(await copyShareText('hello', none)).toBe(true);
    expect(none.copyFallback).toHaveBeenCalledWith('hello');

    const refuses = env({ writeText: vi.fn(async () => Promise.reject(new Error('no'))) });
    expect(await copyShareText('hello', refuses)).toBe(true);
    expect(refuses.copyFallback).toHaveBeenCalledWith('hello');
  });

  it('says so when nothing worked', async () => {
    expect(await copyShareText('hello', env({ copyFallback: vi.fn(() => false) }))).toBe(false);
  });
});
