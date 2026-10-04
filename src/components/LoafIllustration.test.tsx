// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CROSSFADE_CLEANUP_MS, LoafIllustration } from './LoafIllustration';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('LoafIllustration', () => {
  it('shows the picture for the stage, hidden from screen readers', () => {
    const { container } = render(<LoafIllustration bread="sandwich" stage="proof" />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(1);
    expect(imgs[0].getAttribute('src')).toContain('proof');
    expect(imgs[0].getAttribute('alt')).toBe('');
    expect(imgs[0].getAttribute('aria-hidden')).toBe('true');
    expect(imgs[0].className).not.toContain('--in');
  });

  it('fades the new stage in over the old one, then drops the old picture', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<LoafIllustration bread="sandwich" stage="shape" />);
    rerender(<LoafIllustration bread="sandwich" stage="proof" />);
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(2);
    expect(imgs[0].className).toContain('--out');
    expect(imgs[0].getAttribute('src')).toContain('shape');
    expect(imgs[1].className).toContain('--in');
    expect(imgs[1].getAttribute('src')).toContain('proof');
    expect(container.querySelector('.loaf-art')?.getAttribute('data-stage')).toBe('proof');

    act(() => {
      vi.advanceTimersByTime(CROSSFADE_CLEANUP_MS);
    });
    expect(container.querySelectorAll('img')).toHaveLength(1);
  });
});
