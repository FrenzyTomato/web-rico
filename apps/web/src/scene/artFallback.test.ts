import { expect, it, vi } from 'vitest';
import { withArtBackup } from './artFallback.js';
it('uses compressed art without downloading the backup when successful', async () => {
  const original = vi.fn(async () => 'original');
  expect(await withArtBackup(async () => 'compressed', original)).toBe('compressed');
  expect(original).not.toHaveBeenCalled();
});
it('falls back for network or decoder failures and propagates failure of both variants', async () => {
  const fail = async () => { throw Error('decoder unavailable'); };
  expect(await withArtBackup(fail, async () => 'original')).toBe('original');
  await expect(withArtBackup(fail, async () => { throw Error('backup unavailable'); })).rejects.toThrow('backup unavailable');
});
