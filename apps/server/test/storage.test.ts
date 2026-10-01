import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';
import { applyCommand, createId } from '@vibe-rico/game-engine';
import type { GameCommand, PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { Lobby } from '../src/rooms/lobby.js';
import type { Room, RoomStore } from '../src/rooms/store.js';
import { connect } from '../src/storage/postgresStore.js';

// Real PostgreSQL only (run via `pnpm --filter @vibe-rico/server test:db`); skipped without DATABASE_URL.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('PostgreSQL room store', () => {
  let store: RoomStore, close: () => Promise<void>, sql: postgres.Sql;
  beforeAll(async () => {
    sql = postgres(url!, { onnotice: () => {} });
    await sql`drop schema if exists public cascade`; await sql`drop schema if exists drizzle cascade`; await sql`create schema public`;
    ({ store, close } = await connect(url!));
  });
  afterAll(async () => { await close(); await sql.end(); });

  it('the initial migration creates the four tables on an empty database', async () => {
    const tables = await sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name`;
    expect(tables.map(t => t.table_name)).toEqual(['commands', 'events', 'rooms', 'seats']);
    const applied = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    expect(applied[0]!.n).toBe(1);
  });

  /** Plays the same lobby + command sequence against a store; returns the final stored room. */
  async function play(target: RoomStore, prefix: string) {
    let n = 0;
    const lobby = new Lobby(target, { id: () => `${prefix}-${++n}`, roomCode: () => `${prefix}C${n}`, seed: () => 4294967295, pick: () => 0 });
    const created = await lobby.createRoom('Ana');
    if (!created.ok) throw Error(created.code);
    const seats: PlayerId[] = [created.value.playerId];
    for (const name of ['Bo', 'Chen']) { const j = await lobby.joinRoom(created.value.roomCode, name); if (!j.ok) throw Error(j.code); seats.push(j.value.playerId); }
    await lobby.startGame(created.value.roomId, seats[0]!);
    const queues = new RoomQueues();
    const roomId = created.value.roomId;
    let state = (await target.get(roomId))!.room.game!.state;
    // Three legal moves: the Governor picks Planter, then the first two planters take the first market estate.
    for (let k = 0; k < 3; k++) {
      const actor = 'actorId' in state.phase ? state.phase.actorId : seats[0]!;
      const action = k === 0 ? { kind: 'choose-role', roleCardId: state.roleCards[0]!.instanceId }
        : { kind: 'plant', choice: { kind: 'estate', tileId: state.estateMarket[0]!.instanceId } };
      const reply = await submitCommand(target, queues, roomId, actor, { protocolVersion: PROTOCOL_VERSION, roomId, commandId: `c${k}`, expectedRevision: state.revision, action } as never, () => true);
      expect(reply).toMatchObject({ acceptedRevision: state.revision + 1 });
      const r = applyCommand(state, { ...action, actorId: actor } as GameCommand);
      if (!r.ok) throw Error(r.error.message);
      state = r.state;
    }
    return (await target.get(roomId))!;
  }

  it('round-trips rooms, seats, snapshots, deduplication results and events exactly like the in-memory store', async () => {
    const memory = await play(new InMemoryRoomStore(), 'mem');
    const stored = await play(store, 'mem');
    // Tokens are random per run, so compare everything except the hashes, then check the hashes themselves.
    const withoutHashes = (r: typeof stored) => ({ ...r, room: { ...r.room, seats: r.room.seats.map(({ tokenHash: _, ...seat }) => seat) } });
    expect(withoutHashes(stored)).toEqual(withoutHashes(memory));
    expect(stored.room.seats.every(s => /^[0-9a-f]{64}$/.test(s.tokenHash))).toBe(true);
    expect(stored.room.game!.seed).toBe(4294967295);
    expect(stored.room.game!.commands.map(c => c.events.length)).toEqual(memory.room.game!.commands.map(c => c.events.length));
    expect(await store.findByCode(stored.room.roomCode)).toEqual(stored);
    const [row] = await sql`select snapshot_schema_version, snapshot_engine_version from rooms where room_id = ${stored.room.roomId}`;
    expect(row).toEqual({ snapshot_schema_version: stored.room.game!.state.schemaVersion, snapshot_engine_version: stored.room.game!.state.engineVersion });
  });

  it('enforces unique room IDs, room codes, seat token hashes and command keys', async () => {
    const room = (roomId: string, roomCode: string, tokenHash: string): Room => ({ roomId, roomCode, hostPlayerId: createId('player', 'h'),
      seats: [{ playerId: createId('player', 'h'), displayName: 'H', tokenHash }], game: null });
    expect(await store.create(room('u1', 'CODE-A', 'hash-1'))).toBe(true);
    expect(await store.create(room('u1', 'CODE-B', 'hash-2'))).toBe(false);
    expect(await store.create(room('u2', 'CODE-A', 'hash-3'))).toBe(false);
    expect(await store.create(room('u3', 'CODE-C', 'hash-1'))).toBe(false);
    // A failed create leaves nothing behind.
    expect(await store.get('u3')).toBeUndefined();
    await expect(sql`insert into commands values ('u1','h','x',0,'{}',1), ('u1','h','x',0,'{}',2)`).rejects.toThrow();
  });

  it('rejects stale revisions without writing, and lets exactly one of two concurrent writers win', async () => {
    const r: Room = { roomId: 'rev', roomCode: 'CODE-REV', hostPlayerId: createId('player', 'h'), seats: [{ playerId: createId('player', 'h'), displayName: 'H', tokenHash: 'hash-rev' }], game: null };
    await store.create(r);
    expect(await store.update({ ...r, seats: [...r.seats, { playerId: createId('player', 'x'), displayName: 'X', tokenHash: 'hash-x' }] }, 5)).toBe('stale');
    expect((await store.get('rev'))!).toEqual({ room: r, revision: 0 });
    const results = await Promise.all([1, 2].map(i => store.update({ ...r, seats: [...r.seats, { playerId: createId('player', `p${i}`), displayName: `P${i}`, tokenHash: `hash-p${i}` }] }, 0)));
    expect(results.sort()).toEqual(['ok', 'stale']);
    expect((await store.get('rev'))!.revision).toBe(1);
    expect(await store.delete('rev', 0)).toBe('stale');
    expect(await store.delete('rev', 1)).toBe('ok');
    expect(await store.get('rev')).toBeUndefined();
    expect(await sql`select * from seats where room_id = 'rev'`).toHaveLength(0);
  });
});
