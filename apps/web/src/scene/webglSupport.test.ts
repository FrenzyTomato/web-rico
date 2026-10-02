import { afterEach, beforeEach, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); });

it('repeated render-time checks allocate only one temporary context and release it', async () => {
  const loseContext = vi.fn();
  const getExtension = vi.fn(() => ({ loseContext }));
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension } as never);
  const { webglAvailable } = await import('./webglSupport.js');
  for (let update = 0; update < 100; update++) expect(webglAvailable()).toBe(true);
  expect(getContext).toHaveBeenCalledExactlyOnceWith('webgl2');
  expect(getExtension).toHaveBeenCalledExactlyOnceWith('WEBGL_lose_context');
  expect(loseContext).toHaveBeenCalledTimes(1);
});

it('caches an unavailable result without falling back to unsupported WebGL 1', async () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const { webglAvailable } = await import('./webglSupport.js');
  for (let update = 0; update < 20; update++) expect(webglAvailable()).toBe(false);
  expect(getContext).toHaveBeenCalledExactlyOnceWith('webgl2');
});

it('handles a browser that throws while creating a context', async () => {
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => { throw Error('graphics unavailable'); });
  const { webglAvailable } = await import('./webglSupport.js');
  expect(webglAvailable()).toBe(false);
  expect(webglAvailable()).toBe(false);
  expect(getContext).toHaveBeenCalledTimes(1);
});

it('supports a context without the optional release extension', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as never);
  const { webglAvailable } = await import('./webglSupport.js');
  expect(webglAvailable()).toBe(true);
});
