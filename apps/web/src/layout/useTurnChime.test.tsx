import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { useTurnChime } from './useTurnChime.js';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('chimes once on entering a turn, not rerenders or reconnects, and respects mute', () => {
  const start = vi.fn();
  class Audio {
    state = 'running'; currentTime = 0; destination = {};
    close = vi.fn(async () => {});
    createOscillator = () => ({ type: '', frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start, stop: vi.fn(), onended: null });
    createGain = () => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() } });
  }
  vi.stubGlobal('AudioContext', Audio);
  function Harness({ turn, connected = true, enabled = true }: { turn: boolean; connected?: boolean; enabled?: boolean }) {
    useTurnChime(turn, connected, enabled); return null;
  }
  const screen = render(<Harness turn={false} />);
  fireEvent.pointerDown(window);
  screen.rerender(<Harness turn />);
  expect(start).toHaveBeenCalledTimes(2);
  screen.rerender(<Harness turn />);
  screen.rerender(<Harness turn connected={false} />);
  screen.rerender(<Harness turn />);
  expect(start).toHaveBeenCalledTimes(2);
  screen.rerender(<Harness turn={false} enabled={false} />);
  screen.rerender(<Harness turn enabled={false} />);
  expect(start).toHaveBeenCalledTimes(2);
});
