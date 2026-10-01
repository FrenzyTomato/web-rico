import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import postgres from 'postgres';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { Lobby } from '../src/rooms/lobby.js';
import type { RoomStore } from '../src/rooms/store.js';
import { connect } from '../src/storage/postgresStore.js';
import { io as connectClient } from 'socket.io-client';
import { createApp } from '../src/app.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';

// TS-DURABLE on real PostgreSQL (run via `pnpm --filter @vibe-rico/server test:db`); skipped without DATABASE_URL.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('atomic commits and failure handling', () => {
  let store: RoomStore, close: () => Promise<void>, sql: postgres.Sql, n = 0;
  beforeAll(async () => {
    sql = postgres(url!, { onnotice: () => {} });
    await sql`drop schema if exists public cascade`; await sql`drop schema if exists drizzle cascade`; await sql`create schema public`;
    ({ store, close } = await connect(url!));
  });
  afterAll(async () => { await close(); await sql.end(); });

  /** A started 3-player room; returns the Governor and a request for its first role choice. */
  async function started(target: RoomStore) {
    const tag = `f${++n}`;
    let k = 0;
    const lobby = new Lobby(target, { id: () => `${tag}-${++k}`, roomCode: () => `${tag}-CODE${k}`, seed: () => 7, pick: () => 0 });
    const created = await lobby.createRoom('A');
    if (!created.ok) throw Error(created.code);
    for (const name of ['B', 'C']) await lobby.joinRoom(created.value.roomCode, name);
    await lobby.startGame(created.value.roomId, created.value.playerId);
    const roomId = created.value.roomId, governor = created.value.playerId;
    const state = (await target.get(roomId))!.room.game!.state;
    const request = (commandId: string, roleIndex = 0) => ({ protocolVersion: PROTOCOL_VERSION, roomId, commandId, expectedRevision: state.revision,
      action: { kind: 'choose-role', roleCardId: state.roleCards[roleIndex]!.instanceId } }) as never;
    const row = async () => (await sql`select revision, (select count(*)::int from commands where room_id = ${roomId}) as commands,
      (select count(*)::int from events where room_id = ${roomId}) as events from rooms where room_id = ${roomId}`)[0]!;
    return { roomId, governor: governor as PlayerId, request, row };
  }

  it('a failure during the commit rolls back everything and is never acknowledged or broadcast', async () => {
    const { roomId, governor, request, row } = await started(store);
    const before = await row();
    // A conflicting event row makes the transaction's event insert fail after the room row was updated.
    await sql`insert into events values (${roomId}, 1, 0, '{}')`;
    const onCommitted = vi.fn(async () => {});
    expect(await submitCommand(store, new RoomQueues(), roomId, governor, request('c1'), () => true, onCommitted)).toEqual({ commandId: 'c1', code: 'STORE_UNAVAILABLE' });
    expect(onCommitted).not.toHaveBeenCalled();
    expect(await row()).toEqual({ ...before, events: before.events + 1 });
    // With the obstacle gone, the same command commits at the very next revision: nothing was consumed.
    await sql`delete from events where room_id = ${roomId} and revision = 1`;
    expect(await submitCommand(store, new RoomQueues(), roomId, governor, request('c1'), () => true, onCommitted)).toEqual({ commandId: 'c1', acceptedRevision: 1 });
    expect(onCommitted).toHaveBeenCalledTimes(1);
  });

  it('a failure before the commit (database unreachable) is reported, not thrown, and not broadcast', async () => {
    const other = await connect(url!);
    const { roomId, governor, request } = await started(other.store);
    await other.close();
    const onCommitted = vi.fn(async () => {});
    expect(await submitCommand(other.store, new RoomQueues(), roomId, governor, request('c1'), () => true, onCommitted)).toEqual({ commandId: 'c1', code: 'STORE_UNAVAILABLE' });
    expect(onCommitted).not.toHaveBeenCalled();
  });

  it('a compare-and-set conflict from another server fails without writing or broadcasting', async () => {
    const { roomId, governor, request, row } = await started(store);
    const second = await connect(url!);
    // Server 2 reads first; server 1 commits before server 2 writes.
    const racing: RoomStore = { ...second.store, get: id => second.store.get(id), findByCode: c => second.store.findByCode(c), create: r => second.store.create(r), delete: (id, r) => second.store.delete(id, r), listRoomIds: () => second.store.listRoomIds(),
      update: async (room, expected) => {
        await submitCommand(store, new RoomQueues(), roomId, governor, request('first', 0), () => true);
        return second.store.update(room, expected);
      } };
    const onCommitted = vi.fn(async () => {});
    expect(await submitCommand(racing, new RoomQueues(), roomId, governor, request('second', 1), () => true, onCommitted)).toEqual({ commandId: 'second', code: 'STALE_REVISION' });
    expect(onCommitted).not.toHaveBeenCalled();
    expect(await sql`select command_id from commands where room_id = ${roomId}`).toEqual([{ command_id: 'first' }]);
    expect((await row()).revision).toBe(4);
    await second.close();
  });

  it('acknowledges only after the commit is visible, and revisions stay contiguous', async () => {
    const { roomId, governor, request } = await started(store);
    let seenDuringBroadcast: unknown = null;
    const reply = await submitCommand(store, new RoomQueues(), roomId, governor, request('c1'), () => true, async () => {
      seenDuringBroadcast = (await sql`select accepted_revision from commands where room_id = ${roomId}`)[0];
    });
    expect(reply).toEqual({ commandId: 'c1', acceptedRevision: 1 });
    expect(seenDuringBroadcast).toEqual({ accepted_revision: 1 });
    const revisions = await sql`select distinct revision from events where room_id = ${roomId} order by revision`;
    expect(revisions.map(r => r.revision)).toEqual([1]);
  });
});

describe('store failures at the socket boundary', () => {
  it('answers STORE_UNAVAILABLE instead of crashing when the store throws, and keeps serving', async () => {
    const broken = new InMemoryRoomStore();
    broken.get = async () => { throw Error('database down'); };
    broken.findByCode = async () => { throw Error('database down'); };
    const { app } = createApp({ store: broken });
    await app.listen({ host: '127.0.0.1', port: 0 });
    const address = app.server.address() as { port: number };
    const client = connectClient(`http://127.0.0.1:${address.port}`, { transports: ['websocket'] });
    await new Promise<void>(resolve => client.on('connect', () => resolve()));
    expect(await client.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId: 'r', token: 't' })).toEqual({ ok: false, code: 'STORE_UNAVAILABLE' });
    expect(await client.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action: { kind: 'join-room', roomCode: 'X', displayName: 'B' } }))
      .toEqual({ ok: false, code: 'STORE_UNAVAILABLE' });
    expect((await app.inject({ method: 'GET', url: '/health' })).statusCode).toBe(200);
    client.disconnect();
    await app.close();
  });
});
