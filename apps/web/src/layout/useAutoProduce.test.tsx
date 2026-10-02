import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { useAutoProduce } from './useAutoProduce.js';
afterEach(cleanup);
const snapshot = (phase = 'craftsman-production', factoryChoices = [false, true]) => ({ revision: 12, view: { viewer: { playerId: 'me' } }, legalActions: [{ phase, factoryChoices }] }) as unknown as PlayerBroadcast;
it('requires opt-in and connection, prefers Factory income, and does not repeat on rerenders or reconnect', () => {
  const submit = vi.fn(); const latest = snapshot();
  const hook = renderHook(({ enabled, connected, pending }) => useAutoProduce(latest, 'room', enabled, connected, pending, submit), { initialProps: { enabled: false, connected: true, pending: false } });
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ enabled: true, connected: false, pending: false });
  hook.rerender({ enabled: true, connected: true, pending: true });
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ enabled: true, connected: true, pending: false });
  expect(submit).toHaveBeenCalledWith({ kind: 'produce', production: { accept: true, useFactory: true } });
  hook.rerender({ enabled: true, connected: false, pending: false });
  hook.rerender({ enabled: true, connected: true, pending: false });
  expect(submit).toHaveBeenCalledTimes(1);
});
it('leaves bonus choices and other players alone, and supports production without a Factory', () => {
  const submit = vi.fn();
  const hook = renderHook(({ latest }) => useAutoProduce(latest, 'room', true, true, false, submit), { initialProps: { latest: snapshot('craftsman-bonus') } });
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ latest: { ...snapshot(), legalActions: [] } });
  expect(submit).not.toHaveBeenCalled();
  hook.rerender({ latest: snapshot('craftsman-production', [false]) });
  expect(submit).toHaveBeenCalledWith({ kind: 'produce', production: { accept: true, useFactory: false } });
});
