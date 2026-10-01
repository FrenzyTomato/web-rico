import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { GameplayRequest } from '@vibe-rico/protocol';
import { createApp } from '../src/app.js';
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { RoomLifecycle } from '../src/rooms/lifecycle.js';
import { LIMITS, RateLimiter } from '../src/rooms/limits.js';
import { Lobby } from '../src/rooms/lobby.js';

const TTL = 1000;
async function setup(size: number) {
  let n = 0, now = 0;
  const store = new InMemoryRoomStore(), queues = new RoomQueues();
  const lobby = new Lobby(store, { id: () => `id-${++n}`, roomCode: () => `CODE${n}`, seed: () => 3, pick: () => 0 });
  const lifecycle = new RoomLifecycle(store, queues, () => now, TTL);
  const created = await lobby.createRoom('host');
  if (!created.ok) throw Error(created.code);
  const seats: PlayerId[] = [created.value.playerId];
  for (let i = 1; i < size; i++) {
    const joined = await lobby.joinRoom(created.value.roomCode, `p${i}`);
    if (!joined.ok) throw Error(joined.code);
    seats.push(joined.value.playerId);
  }
  for (const s of seats) lifecycle.connected(created.value.roomId, s);
  const { roomId, roomCode } = created.value;
  return { store, queues, lobby, lifecycle, roomId, roomCode, seats,
    room: () => store.get(roomId), advance: (ms: number) => { now += ms; } };
}
const choose = (roleCardId: string, commandId: string, expectedRevision: number): GameplayRequest =>
  ({ protocolVersion: PROTOCOL_VERSION, roomId: 'r', commandId, expectedRevision, action: { kind: 'choose-role', roleCardId: roleCardId as never } });

describe('pregame leaving and host transfer', () => {
  it('removes a leaving seat, passes the host to the next seat, and removes the room with the last seat', async () => {
    const { lifecycle, roomId, roomCode, seats, room, store } = await setup(3);
    expect(await lifecycle.leave(roomId, seats[1]!)).toEqual({ ok: true, value: null });
    expect((await room())!.room.seats.map(s => s.playerId)).toEqual([seats[0], seats[2]]);
    expect(await lifecycle.leave(roomId, seats[0]!)).toEqual({ ok: true, value: null });
    expect((await room())!.room).toMatchObject({ hostPlayerId: seats[2], seats: [{ playerId: seats[2] }] });
    expect(await lifecycle.leave(roomId, seats[2]!)).toEqual({ ok: true, value: null });
    expect(await room()).toBeUndefined();
    expect(await store.findByCode(roomCode)).toBeUndefined();
  });

  it('keeps seats fixed after start and rejects unseated leavers', async () => {
    const { lobby, lifecycle, roomId, seats, room } = await setup(3);
    expect(await lifecycle.leave(roomId, 'stranger' as PlayerId)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    await lobby.startGame(roomId, seats[0]!);
    const before = await room();
    expect(await lifecycle.leave(roomId, seats[1]!)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    expect(await room()).toBe(before);
  });
});

describe('closure', () => {
  it('lets only the host close; later joins, starts and commands see the room as closed', async () => {
    const { lobby, lifecycle, store, queues, roomId, roomCode, seats, room } = await setup(3);
    expect(await lifecycle.close(roomId, seats[1]!)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await room()).toBeDefined();
    expect(await lifecycle.close(roomId, seats[0]!)).toEqual({ ok: true, value: null });
    expect(await room()).toBeUndefined();
    expect(await lobby.joinRoom(roomCode, 'late')).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
    expect(await lobby.startGame(roomId, seats[0]!)).toEqual({ ok: false, code: 'ROOM_CLOSED' });
    expect(await submitCommand(store, queues, roomId, seats[0]!, choose('role-1', 'c', 0), () => true)).toEqual({ commandId: 'c', code: 'ROOM_CLOSED' });
    expect(await lifecycle.close(roomId, seats[0]!)).toEqual({ ok: false, code: 'ROOM_CLOSED' });
  });

  it('start then close closes the started game; close then start reports ROOM_CLOSED', async () => {
    const a = await setup(3);
    expect(await a.lobby.startGame(a.roomId, a.seats[0]!)).toEqual({ ok: true, value: null });
    expect(await a.lifecycle.close(a.roomId, a.seats[0]!)).toEqual({ ok: true, value: null });
    expect(await a.room()).toBeUndefined();
    const b = await setup(3);
    expect(await b.lifecycle.close(b.roomId, b.seats[0]!)).toEqual({ ok: true, value: null });
    expect(await b.lobby.startGame(b.roomId, b.seats[0]!)).toEqual({ ok: false, code: 'ROOM_CLOSED' });
  });

  it('a concurrent start and close end in the same state as some serial order', async () => {
    const { lobby, lifecycle, roomId, seats, room } = await setup(3);
    const [start, close] = await Promise.all([lobby.startGame(roomId, seats[0]!), lifecycle.close(roomId, seats[0]!)]);
    const stored = await room();
    // start→close: both succeed, room gone. close→start: start sees ROOM_CLOSED. Overlap: one write is STALE.
    const outcomes = [
      { start: { ok: true, value: null }, close: { ok: true, value: null }, exists: false },
      { start: { ok: false, code: 'ROOM_CLOSED' }, close: { ok: true, value: null }, exists: false },
      { start: { ok: true, value: null }, close: { ok: false, code: 'STALE_REVISION' }, exists: true },
      { start: { ok: false, code: 'STALE_REVISION' }, close: { ok: true, value: null }, exists: false },
    ];
    expect(outcomes).toContainEqual({ start, close, exists: stored !== undefined });
    if (stored) expect(stored.room.game).not.toBeNull();
  });
});

describe('disconnection and empty-room cleanup', () => {
  it('preserves a disconnected player’s seat and game, and accepts their commands after reconnecting', async () => {
    const { lobby, lifecycle, store, queues, roomId, seats, room, advance } = await setup(3);
    await lobby.startGame(roomId, seats[0]!);
    const before = await room();
    lifecycle.disconnected(roomId, seats[0]!);
    advance(10 * TTL);
    await lifecycle.sweep();
    expect(await room()).toBe(before);
    lifecycle.connected(roomId, seats[0]!);
    const card = before!.room.game!.state.roleCards[0]!.instanceId;
    expect(await submitCommand(store, queues, roomId, seats[0]!, choose(card, 'c1', 0), () => true)).toEqual({ commandId: 'c1', acceptedRevision: 1 });
  });

  it('never removes a room with a connected player, however old', async () => {
    const { lifecycle, roomId, seats, room, advance } = await setup(3);
    lifecycle.disconnected(roomId, seats[0]!);
    lifecycle.disconnected(roomId, seats[1]!);
    for (let i = 0; i < 5; i++) { advance(TTL * 100); await lifecycle.sweep(); }
    expect(await room()).toBeDefined();
  });

  it('removes a room only after it has been empty for the full TTL; a reconnect resets the timer', async () => {
    const { lifecycle, roomId, seats, room, advance } = await setup(3);
    for (const s of seats) lifecycle.disconnected(roomId, s);
    advance(TTL - 1);
    await lifecycle.sweep();
    expect(await room()).toBeDefined();
    lifecycle.connected(roomId, seats[2]!);
    lifecycle.disconnected(roomId, seats[2]!);
    advance(TTL - 1);
    await lifecycle.sweep();
    expect(await room()).toBeDefined();
    advance(1);
    await lifecycle.sweep();
    expect(await room()).toBeUndefined();
  });
});

describe('rate limits', () => {
  let close = async () => {};
  let client: Socket | undefined;
  afterEach(async () => { client?.disconnect(); await close(); });

  it('allows the documented events per window and resets on the next window', () => {
    const limiter = new RateLimiter(LIMITS.eventsPerWindow, LIMITS.windowMs);
    for (let i = 0; i < LIMITS.eventsPerWindow; i++) expect(limiter.allow('s', 0)).toBe(true);
    expect(limiter.allow('s', LIMITS.windowMs - 1)).toBe(false);
    expect(limiter.allow('other', 0)).toBe(true);
    expect(limiter.allow('s', LIMITS.windowMs)).toBe(true);
  });

  it('closes a connection that exceeds the limit', async () => {
    const { app } = createApp();
    await app.listen({ host: '127.0.0.1', port: 0 });
    close = () => app.close();
    const address = app.server.address();
    if (!address || typeof address === 'string') throw Error('no port');
    client = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'] });
    await new Promise<void>(resolve => client!.on('connect', () => resolve()));
    const reason = new Promise<string>(resolve => client!.on('disconnect', resolve));
    for (let i = 0; i <= LIMITS.eventsPerWindow; i++) client.emit('command', {});
    expect(await reason).toBe('io server disconnect');
  });
});

describe('restart recovery (PR-058)', () => {
  it('stored rooms start empty after a restart: swept after the full TTL unless a player resumes', async () => {
    const { store, queues, roomId, seats, advance } = await setup(3);
    let now = 0;
    const restarted = new RoomLifecycle(store, queues, () => now, TTL);
    const { recoverRooms } = await import('../src/storage/recoverRoom.js');
    const other = await new Lobby(store, { id: () => 'o-id', roomCode: () => 'OTHER', seed: () => 1, pick: () => 0 }).createRoom('Z');
    if (!other.ok) throw Error(other.code);
    expect(await recoverRooms(store, restarted)).toBe(2);
    restarted.connected(roomId, seats[0]!);
    now = TTL; advance(TTL);
    await restarted.sweep();
    expect(await store.get(roomId)).toBeDefined();
    expect(await store.get(other.value.roomId)).toBeUndefined();
  });
});
