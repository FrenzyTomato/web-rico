import { afterEach, describe, expect, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { deserializeGame, replay } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { PlayerBroadcast, SeatGranted } from '@vibe-rico/protocol';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { createApp } from '../src/app.js';

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of cleanup.reverse()) await c(); cleanup = []; });

async function table(devTools: boolean) {
  const { app } = createApp({ devTools });
  await app.listen({ host: '127.0.0.1', port: 0 });
  cleanup.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw Error('no port');
  const client = async () => {
    const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
    const states: PlayerBroadcast[] = [];
    socket.on('state', (b: PlayerBroadcast) => states.push(b));
    cleanup.push(async () => { socket.disconnect(); });
    await new Promise<void>(resolve => socket.on('connect', () => resolve()));
    return { socket, states };
  };
  const room = (s: Socket, action: object) => s.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });
  const seats = [await client(), await client(), await client()];
  const host: { value: SeatGranted } = await room(seats[0]!.socket, { kind: 'create-room', displayName: 'A' });
  for (const s of seats.slice(1)) await room(s.socket, { kind: 'join-room', roomCode: host.value.roomCode, displayName: 'B' });
  await room(seats[0]!.socket, { kind: 'start-game', roomId: host.value.roomId });
  await new Promise(r => setTimeout(r, 50));
  const roomId = host.value.roomId;
  /** The seat whose latest view offers a choice plays its first role card (a legal move). */
  const playRole = async (commandId: string) => {
    const actor = seats.find(s => s.states.at(-1)!.legalActions.length > 0)!;
    const legal = actor.states.at(-1)!.legalActions[0] as { roleCardIds?: string[] };
    return actor.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId,
      expectedRevision: actor.states.at(-1)!.revision, action: { kind: 'choose-role', roleCardId: legal.roleCardIds![0] } });
  };
  return { client, room, seats, roomId, playRole };
}
const exportFrom = (s: Socket, roomId: string) => s.emitWithAck('debug-export', { roomId });
const importTo = (s: Socket, roomId: string, record: unknown) => s.emitWithAck('debug-import', { roomId, replay: record });

describe('developer scenario tools', () => {
  it('do not exist unless the server is started with dev tools enabled', async () => {
    const { seats, roomId } = await table(false);
    await expect(seats[0]!.socket.timeout(300).emitWithAck('debug-export', { roomId })).rejects.toThrow();
    await expect(seats[0]!.socket.timeout(300).emitWithAck('debug-import', { roomId, replay: {} })).rejects.toThrow();
  });

  it('refuse unauthenticated, other-room and lobby-room access', async () => {
    const { client, room, seats, roomId } = await table(true);
    const stranger = await client();
    expect(await exportFrom(stranger.socket, roomId)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await importTo(stranger.socket, roomId, {})).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    const other: { value: SeatGranted } = await room(stranger.socket, { kind: 'create-room', displayName: 'Z' });
    expect(await exportFrom(stranger.socket, roomId)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await exportFrom(stranger.socket, other.value.roomId)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    expect(await exportFrom(seats[1]!.socket, other.value.roomId)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
  });

  it('export gives a replay record that reproduces the copied current snapshot', async () => {
    const { seats, roomId, playRole } = await table(true);
    expect(await playRole('c1')).toMatchObject({ acceptedRevision: 1 });
    const exported = await exportFrom(seats[2]!.socket, roomId);
    expect(exported.value.replay.commands).toHaveLength(1);
    const replayed = replay(exported.value.replay);
    expect(replayed).toMatchObject({ ok: true, state: deserializeGame(exported.value.snapshot) });
  });

  it('rejects damaged snapshots and names the first bad command, leaving the game untouched', async () => {
    const { seats, roomId, playRole } = await table(true);
    await playRole('c1');
    const before = await exportFrom(seats[0]!.socket, roomId);
    const damaged = JSON.parse(JSON.stringify(before.value.replay));
    damaged.initialState.players[0].goods.corn += 1;
    expect(await importTo(seats[0]!.socket, roomId, damaged)).toEqual({ ok: false, failure: { kind: 'invalid-snapshot', path: '$.initialState' } });
    const badCommand = JSON.parse(JSON.stringify(before.value.replay));
    badCommand.commands.push(badCommand.commands[0]);
    expect(await importTo(seats[0]!.socket, roomId, badCommand)).toMatchObject({ ok: false, failure: { kind: 'rejected-command', index: 1, error: { code: 'WRONG_PHASE' } } });
    expect(await importTo(seats[0]!.socket, roomId, JSON.parse(JSON.stringify(three)))).toMatchObject({ ok: false });
    expect(await exportFrom(seats[0]!.socket, roomId)).toEqual(before);
  });

  it('imports a valid history, rejects foreign seats, and broadcasts the imported state', async () => {
    const { seats, roomId, playRole } = await table(true);
    const start = await exportFrom(seats[0]!.socket, roomId);
    await playRole('c1');
    // A complete fixture from other player IDs cannot enter this room.
    const created = replay({ ...start.value.replay, commands: [] });
    expect(created.ok).toBe(true);
    const foreign = JSON.parse(JSON.stringify(start.value.replay));
    foreign.initialState.seatOrder = ['x', 'y', 'z'];
    expect(await importTo(seats[0]!.socket, roomId, foreign)).toMatchObject({ ok: false });
    expect(await importTo(seats[1]!.socket, roomId, start.value.replay)).toEqual({ ok: true, value: { revision: 0 } });
    await new Promise(r => setTimeout(r, 50));
    for (const s of seats) expect(s.states.at(-1)!.revision).toBe(0);
    expect((await exportFrom(seats[0]!.socket, roomId)).value.replay.commands).toEqual([]);
  });
});
