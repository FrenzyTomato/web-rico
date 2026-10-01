import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';
import { createGame, createId, replay, RULESET } from '@vibe-rico/game-engine';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { exportRoom } from '../src/debug/scenarios.js';
import { broadcastFor } from '../src/rooms/broadcast.js';
import { Lobby } from '../src/rooms/lobby.js';
import type { RoomStore } from '../src/rooms/store.js';
import { connect } from '../src/storage/postgresStore.js';
import { guardSnapshot, IncompatibleSave } from '../src/storage/versionGuard.js';

const fresh = () => {
  const r = createGame({ rulesetId: RULESET.id, gameId: createId('game', 'g'), seatOrder: ['a', 'b', 'c'].map(p => createId('player', p)), governorPlayerId: createId('player', 'a'), seed: 1 });
  if (!r.ok) throw Error(r.error.message);
  return JSON.parse(JSON.stringify(r.state)) as Record<string, unknown>;
};

describe('snapshot version guard', () => {
  it('accepts the current version, upgrades only through known steps, and rejects anything else', () => {
    expect(guardSnapshot('r', fresh()).schemaVersion).toBe('1.0.0');
    const old = { ...fresh(), schemaVersion: '0.9.0' };
    expect(() => guardSnapshot('r', old)).toThrow(IncompatibleSave);
    const upgraded = guardSnapshot('r', old, { '0.9.0': raw => ({ ...raw, schemaVersion: '1.0.0' }) });
    expect(upgraded.schemaVersion).toBe('1.0.0');
    expect(old.schemaVersion).toBe('0.9.0');
    expect(() => guardSnapshot('r', { ...fresh(), engineVersion: '9.9.9' })).toThrow(IncompatibleSave);
  });
});

// Real PostgreSQL (run via `pnpm --filter @vibe-rico/server test:db`); skipped without DATABASE_URL.
const url = process.env.DATABASE_URL;
describe.skipIf(!url)('version guards and recovery drills', () => {
  let store: RoomStore, close: () => Promise<void>, sql: postgres.Sql, n = 0;
  beforeAll(async () => {
    sql = postgres(url!, { onnotice: () => {} });
    await sql`drop schema if exists public cascade`; await sql`drop schema if exists drizzle cascade`; await sql`create schema public`;
    await sql`drop database if exists restored`;
    ({ store, close } = await connect(url!));
  });
  afterAll(async () => { await close(); await sql`drop database if exists restored`; await sql.end(); });

  async function started(target: RoomStore) {
    const tag = `v${++n}`;
    let k = 0;
    const lobby = new Lobby(target, { id: () => `${tag}-${++k}`, roomCode: () => `${tag}-CODE${k}`, seed: () => 11, pick: () => 0 });
    const created = await lobby.createRoom('A');
    if (!created.ok) throw Error(created.code);
    for (const name of ['B', 'C']) await lobby.joinRoom(created.value.roomCode, name);
    await lobby.startGame(created.value.roomId, created.value.playerId);
    return { roomId: created.value.roomId, governor: created.value.playerId as PlayerId };
  }
  const roleChoice = (target: RoomStore, roomId: string, commandId: string) => target.get(roomId).then(s => ({ protocolVersion: PROTOCOL_VERSION, roomId, commandId,
    expectedRevision: s!.room.game!.state.revision, action: { kind: 'choose-role', roleCardId: s!.room.game!.state.roleCards[0]!.instanceId } }) as never);

  it('an unsupported save version isolates the room and leaves its stored data untouched', async () => {
    const { roomId, governor } = await started(store);
    const request = await roleChoice(store, roomId, 'c1');
    await sql`update rooms set state = jsonb_set(state, '{schemaVersion}', '"0.9.0"'), snapshot_schema_version = '0.9.0' where room_id = ${roomId}`;
    const before = await sql`select revision, state::text, snapshot_schema_version from rooms where room_id = ${roomId}`;
    expect(await submitCommand(store, new RoomQueues(), roomId, governor, request, () => true)).toEqual({ commandId: 'c1', code: 'VERSION_MISMATCH' });
    expect(await sql`select revision, state::text, snapshot_schema_version from rooms where room_id = ${roomId}`).toEqual(before);
    expect(await sql`select count(*)::int as n from commands where room_id = ${roomId}`).toEqual([{ n: 0 }]);
  });

  it('a save with a known upgrade loads, and the next commit stores the upgraded version', async () => {
    const { roomId, governor } = await started(store);
    const request = await roleChoice(store, roomId, 'c1');
    await sql`update rooms set state = jsonb_set(state, '{schemaVersion}', '"0.9.0"'), initial_state = jsonb_set(initial_state, '{schemaVersion}', '"0.9.0"'), snapshot_schema_version = '0.9.0' where room_id = ${roomId}`;
    const upgrading = await connect(url!, { '0.9.0': raw => ({ ...raw, schemaVersion: '1.0.0' }) });
    expect(await submitCommand(upgrading.store, new RoomQueues(), roomId, governor, request, () => true)).toEqual({ commandId: 'c1', acceptedRevision: 1 });
    expect(await sql`select snapshot_schema_version, state->>'schemaVersion' as v from rooms where room_id = ${roomId}`).toEqual([{ snapshot_schema_version: '1.0.0', v: '1.0.0' }]);
    await upgrading.close();
  });

  it('a restored backup reproduces the replay and every seat’s view; the export holds no credentials', async () => {
    const { roomId, governor } = await started(store);
    expect(await submitCommand(store, new RoomQueues(), roomId, governor, await roleChoice(store, roomId, 'c1'), () => true)).toMatchObject({ acceptedRevision: 1 });
    const original = (await store.get(roomId))!;
    // Backup drill (docs/RECOVERY.md): pg_dump, then pg_restore into a fresh database.
    const container = process.env.PG_CONTAINER!;
    execFileSync('docker', ['exec', container, 'pg_dump', '-U', 'postgres', '-Fc', '-f', '/tmp/backup.dump', 'postgres']);
    await sql`create database restored`;
    execFileSync('docker', ['exec', container, 'pg_restore', '-U', 'postgres', '-d', 'restored', '/tmp/backup.dump']);
    const restored = await connect(url!.replace(/\/postgres$/, '/restored'));
    const copy = (await restored.store.get(roomId))!;
    expect(copy).toEqual(original);
    const exported = await exportRoom(restored.store, roomId);
    if (!exported.ok) throw Error('export');
    expect(replay(exported.value.replay)).toMatchObject({ ok: true, state: original.room.game!.state });
    for (const seat of copy.room.seats) {
      expect(broadcastFor(copy.room.game!.state, [], seat.playerId)).toEqual(broadcastFor(original.room.game!.state, [], seat.playerId));
    }
    await restored.close();
    // The diagnostics export script prints history only: no tokens or token hashes.
    const out = execFileSync(process.execPath, ['scripts/export-history.mjs', roomId], { env: { ...process.env, DATABASE_URL: url! }, encoding: 'utf8' });
    expect(JSON.parse(out).replay.commands).toHaveLength(1);
    for (const seat of original.room.seats) expect(out).not.toContain(seat.tokenHash);
    expect(out).not.toMatch(/token/i);
  });
});
