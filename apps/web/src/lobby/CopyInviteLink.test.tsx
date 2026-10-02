import { beforeEach as setTestLocale } from 'vitest';
import { setLanguage as setTestLanguage } from '../i18n/language.js';
setTestLocale(() => setTestLanguage('zh'));
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CopyInviteLink } from './CopyInviteLink.js';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('copies the exact invitation URL and announces success', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(<CopyInviteLink url="https://webri.co/?room=ABC123" />);
  fireEvent.click(screen.getByRole('button', { name: '复制邀请链接' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('链接已复制'));
  expect(writeText).toHaveBeenCalledWith('https://webri.co/?room=ABC123');
});

it('shows a manual-copy fallback if clipboard access is denied', async () => {
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error('Denied')) } });
  render(<CopyInviteLink url="https://webri.co/?room=ABC123" />);
  fireEvent.click(screen.getByRole('button', { name: '复制邀请链接' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toBe('无法复制，请手动复制链接'));
});
