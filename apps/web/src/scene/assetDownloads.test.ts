// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
it('shares in-flight and completed downloads', async () => {
  const fetcher = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal('fetch', fetcher);
  const { downloadModel } = await import('./assetDownloads.js');
  const first = downloadModel('/model');
  expect(downloadModel('/model')).toBe(first);
  await first;
  expect(downloadModel('/model')).toBe(first);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('allows failed downloads to retry', async () => {
  const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 }))
    .mockResolvedValueOnce(new Response(new Uint8Array([1])));
  vi.stubGlobal('fetch', fetcher);
  const { downloadModel } = await import('./assetDownloads.js');
  await expect(downloadModel('/model')).rejects.toThrow('Model unavailable');
  expect((await downloadModel('/model')).byteLength).toBe(1);
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('warms every board model once with at most two concurrent downloads', async () => {
  let active = 0, maximum = 0;
  const fetcher = vi.fn(async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise(resolve => setTimeout(resolve, 1));
    active--;
    return new Response(new Uint8Array([1]));
  });
  vi.stubGlobal('fetch', fetcher);
  const { preloadBoardModels, BOARD_MODELS, modelUrl, downloadModel } = await import('./assetDownloads.js');
  await Promise.all([preloadBoardModels(), preloadBoardModels()]);
  expect(maximum).toBe(2);
  expect(fetcher).toHaveBeenCalledTimes(BOARD_MODELS.length);
  await downloadModel(modelUrl('Corn Estate', 'runtime-ktx2'));
  expect(fetcher).toHaveBeenCalledTimes(BOARD_MODELS.length);
});
