import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { SeatGranted } from '@vibe-rico/protocol';
import { createApp } from '../src/app.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { Lobby } from '../src/rooms/lobby.js';

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of cleanup.reverse()) await c(); cleanup = []; });

async function server() {
  const { app, io } = createApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  cleanup.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw Error('no port');
  const client = async () => {
    const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
    cleanup.push(async () => { socket.disconnect(); });
    await new Promise<void>(resolve => socket.on('connect', () => resolve()));
    return socket;
  };
  return { io, client };
}
const room = (socket: Socket, action: object) => socket.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });
const resume = (socket: Socket, roomId: string, token: string) => socket.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId, token });
const command = (socket: Socket, roomId: string, commandId: string, expectedRevision: number, roleCardId = 'role-1') =>
  socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId, expectedRevision, action: { kind: 'choose-role', roleCardId } });

/** Three seated players and a started game. The Governor is random, so find who may choose first. */
async function startedGame() {
  const { io, client } = await server();
  const sockets = [await client(), await client(), await client()];
  const host: { ok: true; value: SeatGranted } = await room(sockets[0]!, { kind: 'create-room', displayName: 'A' });
  const seats = [host.value];
  for (const [i, s] of sockets.slice(1).entries()) seats.push((await room(s, { kind: 'join-room', roomCode: host.value.roomCode, displayName: `P${i}` })).value);
  expect(await room(sockets[0]!, { kind: 'start-game', roomId: host.value.roomId })).toEqual({ ok: true, value: null });
  const roomId = host.value.roomId;
  return { io, client, sockets, seats, roomId };
}
/** Only the Governor's choose-role is accepted; rejected probes are not recorded. */
async function governorIndex(sockets: Socket[], roomId: string) {
  for (const [i, s] of sockets.entries()) {
    const r = await command(s, roomId, `first-${i}`, 0);
    if ('acceptedRevision' in r) return { index: i, commandId: `first-${i}` };
  }
  throw Error('no governor');
}

describe('TS-NET: credentials and reconnect', () => {
  it('stores only a hash of each seat token', async () => {
    const store = new InMemoryRoomStore(), lobby = new Lobby(store);
    const created = await lobby.createRoom('A');
    if (!created.ok) throw Error(created.code);
    const stored = (await store.get(created.value.roomId))!;
    expect(stored.room.seats[0]!.tokenHash).toBe(createHash('sha256').update(created.value.token).digest('hex'));
    expect(JSON.stringify(stored)).not.toContain(created.value.token);
  });

  it('refresh: a new connection resumes the seat with its token and can act', async () => {
    const { client, sockets, seats, roomId } = await startedGame();
    sockets[0]!.disconnect();
    const fresh = await client();
    expect(await resume(fresh, roomId, seats[0]!.token)).toEqual({ ok: true, value: { playerId: seats[0]!.playerId, revision: 0 } });
    sockets[0] = fresh;
    const { index } = await governorIndex(sockets, roomId);
    expect(index).toBeGreaterThanOrEqual(0);
  });

  it('network loss: a command whose acknowledgement was lost is retried after resume without a second transition', async () => {
    const { client, sockets, seats, roomId } = await startedGame();
    const { index, commandId } = await governorIndex(sockets, roomId);
    // The first attempt was applied; pretend its acknowledgement was lost with the connection.
    sockets[index]!.disconnect();
    const fresh = await client();
    expect(await resume(fresh, roomId, seats[index]!.token)).toMatchObject({ ok: true, value: { revision: 1 } });
    expect(await command(fresh, roomId, commandId, 0)).toEqual({ commandId, acceptedRevision: 1 });
    const observer = await client();
    expect(await resume(observer, roomId, seats[(index + 1) % 3]!.token)).toMatchObject({ value: { revision: 1 } });
  });

  it('rejects invalid, cross-room and malformed tokens', async () => {
    const { client, seats, roomId } = await startedGame();
    const other = await client();
    const second: { value: SeatGranted } = await room(other, { kind: 'create-room', displayName: 'Z' });
    const probe = await client();
    expect(await resume(probe, roomId, 'not-a-token')).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await resume(probe, roomId, second.value.token)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await resume(probe, second.value.roomId, seats[0]!.token)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await resume(probe, 'no-such-room', seats[0]!.token)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await probe.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId })).toEqual({ ok: false, code: 'BAD_SCHEMA' });
    // An unauthenticated connection cannot act, and a session cannot act in another room.
    expect(await command(probe, roomId, 'c', 0)).toEqual({ commandId: 'c', code: 'UNAUTHORIZED' });
    expect(await command(other, roomId, 'c', 0)).toEqual({ commandId: 'c', code: 'UNAUTHORIZED' });
  });

  it('two tabs: the newest connection controls the seat; the old one is notified and can no longer act', async () => {
    const { client, sockets, seats, roomId } = await startedGame();
    const oldTab = sockets[0]!;
    const replaced = new Promise<void>(resolve => oldTab.on('session-replaced', () => resolve()));
    const newTab = await client();
    expect(await resume(newTab, roomId, seats[0]!.token)).toMatchObject({ ok: true });
    await replaced;
    expect(await command(oldTab, roomId, 'old', 0)).toEqual({ commandId: 'old', code: 'STALE_SESSION' });
    expect(await room(oldTab, { kind: 'leave-room', roomId })).toEqual({ ok: false, code: 'STALE_SESSION' });
    expect(await command(newTab, roomId, 'new', 99)).toEqual({ commandId: 'new', code: 'STALE_REVISION', currentRevision: 0 });
  });

  it('host close over the socket: non-hosts are refused, then the room is closed for everyone', async () => {
    const { sockets, roomId } = await startedGame();
    expect(await room(sockets[1]!, { kind: 'close-room', roomId })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await room(sockets[0]!, { kind: 'close-room', roomId })).toEqual({ ok: true, value: null });
    expect(await command(sockets[1]!, roomId, 'after', 0)).toEqual({ commandId: 'after', code: 'ROOM_CLOSED' });
  });

  it('commands during recovery: the resumed revision and the room channel leave no gap', async () => {
    const { io, client, sockets, seats, roomId } = await startedGame();
    const { index } = await governorIndex(sockets, roomId);
    // role-1 is Planter, so the chooser (Governor) plants first while another seat reconnects.
    const actor = index, resumer = (index + 1) % 3;
    sockets[resumer]!.disconnect();
    const fresh = await client();
    const [planted, resumed] = await Promise.all([
      sockets[actor]!.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'plant', expectedRevision: 1,
        action: { kind: 'plant', choice: { kind: 'decline' } } }),
      resume(fresh, roomId, seats[resumer]!.token),
    ]);
    expect(resumed.ok).toBe(true);
    expect(planted).toEqual({ commandId: 'plant', acceptedRevision: 2 });
    if (planted.acceptedRevision > resumed.value.revision) {
      // Committed after the snapshot read, so the connection was already subscribed for its broadcast.
      expect((await io.in(roomId).fetchSockets()).map(s => s.id)).toContain(fresh.id);
    } else {
      expect(resumed.value.revision).toBe(2);
    }
  });
});
