// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UPDATE_BODY, UPDATE_TITLE, UpdatePrompt, UpdatePromptView } from './UpdatePrompt';

afterEach(cleanup);

describe('New version available', () => {
  it('is calm: says what happened, that nothing is lost, and offers Refresh or Not now', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    const onLater = vi.fn();
    render(<UpdatePromptView onRefresh={onRefresh} onLater={onLater} />);
    const message = screen.getByRole('status');
    expect(message.textContent).toContain(UPDATE_TITLE);
    expect(message.textContent).toContain(UPDATE_BODY);
    expect(message.textContent).not.toMatch(/urgent|now!|expire|lose|lost|failed/i);
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onRefresh).toHaveBeenCalledOnce();
    await user.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onLater).toHaveBeenCalledOnce();
  });

  it('shows nothing until a new version is waiting (and nothing in tests or dev, where there is no service worker)', () => {
    render(<UpdatePrompt />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
