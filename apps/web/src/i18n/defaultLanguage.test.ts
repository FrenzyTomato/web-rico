import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); vi.resetModules(); });

it.each([null, 'en', 'zh', 'invalid'])('loads the saved language (%s), defaulting to English', async saved => {
  vi.resetModules();
  localStorage.clear();
  if (saved !== null) localStorage.setItem('vibe-rico.language', saved);
  const { getLanguage } = await import('./language.js');
  expect(getLanguage()).toBe(saved === 'zh' ? 'zh' : 'en');
});

it('defaults to English when storage is unavailable', async () => {
  vi.resetModules();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
  const { getLanguage } = await import('./language.js');
  expect(getLanguage()).toBe('en');
});
