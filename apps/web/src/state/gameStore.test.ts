import { describe, expect, it, vi } from 'vitest';
import type { CommandAccepted, CommandRejected, GameplayRequest, PlayerBroadcast } from '@vibe-rico/protocol';
import { bindStore } from '../network/commands.js';
import type { LobbySocket } from '../network/socket.js';
import { createGameStore } from './gameStore.js';

type Reply = CommandAccepted | CommandRejected;
/** Records every send; each reply is resolved by the test, or never (a lost acknowledgement). */
function transport() {
  const sent: { request: GameplayRequest; resolve: (reply: Reply) => void }[] = [];
  return { sent, send: (request: GameplayRequest) => new Promise<Reply>(resolve => { sent.push({ request, resolve }); }) };
}
const snapshot = (revision: number) => ({ protocolVersion: '1', revision, view: {}, legalActions: [], events: [] }) as unknown as PlayerBroadcast;
const action = { kind: 'choose-role', roleCardId: 'role-1' } as GameplayRequest['action'];
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
function ready() {
  const t = transport();
  let n = 0;
  const store = createGameStore(t, () => `c${++n}`);
  store.getState().sessionReady();
  store.getState().receive(snapshot(0));
  return { t, store, state: () => store.getState() };
}

describe('client game store', () => {
  it('sends the latest revision and keeps the request pending until acknowledged', () => {
    const { t, state } = ready();
    expect(state().submit('r1', action)).toBe('c1');
    expect(t.sent[0]!.request).toEqual({ protocolVersion: '1', roomId: 'r1', commandId: 'c1', expectedRevision: 0, action });
    expect(state().pending).toEqual({ c1: t.sent[0]!.request });
  });

  it('broadcast before acknowledgement: state comes from the broadcast, the ack only settles the request', async () => {
    const { t, state } = ready();
    state().submit('r1', action);
    state().receive(snapshot(1));
    expect(state().latest!.revision).toBe(1);
    t.sent[0]!.resolve({ commandId: 'c1', acceptedRevision: 1 });
    await settle();
    expect(state().pending).toEqual({});
    expect(state().latest!.revision).toBe(1);
  });

  it('acknowledgement before broadcast: nothing changes until the broadcast arrives', async () => {
    const { t, state } = ready();
    state().submit('r1', action);
    t.sent[0]!.resolve({ commandId: 'c1', acceptedRevision: 1 });
    await settle();
    expect(state().pending).toEqual({});
    expect(state().latest!.revision).toBe(0);
    state().receive(snapshot(1));
    expect(state().latest!.revision).toBe(1);
  });

  it('ignores duplicate and old snapshots', () => {
    const { state } = ready();
    const two = snapshot(2);
    state().receive(two);
    state().receive(snapshot(1));
    state().receive(snapshot(2));
    expect(state().latest).toBe(two);
  });

  it('STALE_REVISION drops the request without rewriting it; the newer snapshot arrives by broadcast', async () => {
    const { t, state } = ready();
    state().submit('r1', action);
    t.sent[0]!.resolve({ commandId: 'c1', code: 'STALE_REVISION', currentRevision: 1 });
    await settle();
    expect(state().pending).toEqual({});
    expect(state().rejection).toEqual({ commandId: 'c1', code: 'STALE_REVISION', currentRevision: 1 });
    expect(t.sent).toHaveLength(1);
    state().receive(snapshot(1));
    expect(state().latest!.revision).toBe(1);
  });

  it('disables sends while disconnected and retries pending commands with their original commandId after resume', async () => {
    const { t, state } = ready();
    state().submit('r1', action);
    // The connection drops before the acknowledgement arrives; that reply is never delivered.
    state().disconnected();
    expect(state().submit('r1', action)).toBeNull();
    expect(t.sent).toHaveLength(1);
    state().sessionReady();
    expect(t.sent).toHaveLength(2);
    expect(t.sent[1]!.request).toEqual(t.sent[0]!.request);
    t.sent[1]!.resolve({ commandId: 'c1', acceptedRevision: 1 });
    await settle();
    expect(state().pending).toEqual({});
  });

  it('keeps a command pending when the transport drops its acknowledgement, and retries it after resume', async () => {
    const sent: GameplayRequest[] = [];
    let fail = true;
    const store = createGameStore({ send: request => { sent.push(request);
      return fail ? Promise.reject(new Error('socket has been disconnected')) : Promise.resolve({ commandId: request.commandId, acceptedRevision: 1 }); } }, () => 'c1');
    store.getState().sessionReady();
    store.getState().receive(snapshot(0));
    store.getState().submit('r1', action);
    await settle();
    expect(Object.keys(store.getState().pending)).toEqual(['c1']);
    fail = false;
    store.getState().disconnected();
    store.getState().sessionReady();
    await settle();
    expect(sent.map(r => r.commandId)).toEqual(['c1', 'c1']);
    expect(store.getState().pending).toEqual({});
  });

  it('keeps the newest events for the chronicle, ignoring duplicate snapshots', () => {
    const { state } = ready();
    const withEvents = (revision: number, n: number) => ({ ...snapshot(revision), events: Array.from({ length: n }, (_, index) => ({ kind: 'phase-changed', revision, index })) }) as unknown as PlayerBroadcast;
    state().receive(withEvents(1, 2));
    state().receive(withEvents(1, 2));
    expect(state().chronicle).toHaveLength(2);
    state().receive(withEvents(2, 60));
    expect(state().chronicle).toHaveLength(50);
    expect(state().chronicle.at(-1)).toMatchObject({ revision: 2, index: 59 });
  });

  it('refuses to send before the first snapshot', () => {
    const store = createGameStore(transport());
    store.getState().sessionReady();
    expect(store.getState().submit('r1', action)).toBeNull();
  });

  it('bindStore feeds state broadcasts and disconnects from the socket', () => {
    const handlers = new Map<string, (arg?: unknown) => void>();
    const socket = { on: (e: string, h: (arg?: unknown) => void) => handlers.set(e, h), off: vi.fn() } as unknown as LobbySocket;
    const { store, state } = ready();
    const unbind = bindStore(socket, store);
    handlers.get('state')!(snapshot(3));
    expect(state().latest!.revision).toBe(3);
    handlers.get('disconnect')!();
    expect(state().connected).toBe(false);
    unbind();
    expect(socket.off).toHaveBeenCalledTimes(2);
  });
});
