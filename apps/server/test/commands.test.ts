import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { GameplayRequest } from '@vibe-rico/protocol';
type PlayerAction = GameplayRequest['action'];
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { Lobby } from '../src/rooms/lobby.js';
import type { Room } from '../src/rooms/store.js';

async function started(store = new InMemoryRoomStore()) {
  let n = 0;
  const lobby = new Lobby(store, { id: () => `id-${++n}`, roomCode: () => `CODE${n}`, seed: () => 7, pick: () => 0 });
  const created = await lobby.createRoom('a');
  if (!created.ok) throw Error(created.code);
  const seats: PlayerId[] = [created.value.playerId];
  for (const name of ['b', 'c']) {
    const joined = await lobby.joinRoom(created.value.roomCode, name);
    if (!joined.ok) throw Error(joined.code);
    seats.push(joined.value.playerId);
  }
  await lobby.startGame(created.value.roomId, seats[0]!);
  const room = async () => (await store.get(created.value.roomId))!;
  const cards = (await room()).room.game!.state.roleCards.map(c => c.instanceId);
  const queues = new RoomQueues();
  const submit = (playerId: PlayerId, request: GameplayRequest) => submitCommand(store, queues, created.value.roomId, playerId, request, () => true);
  return { store, roomId: created.value.roomId, seats, cards, room, submit };
}
const request = (commandId: string, expectedRevision: number, action: PlayerAction): GameplayRequest =>
  ({ protocolVersion: PROTOCOL_VERSION, roomId: 'client-supplied', commandId, expectedRevision, action });
const choose = (roleCardId: string): PlayerAction => ({ kind: 'choose-role', roleCardId: roleCardId as never });

describe('TS-NET: command submission', () => {
  it('applies a valid command once and records the result with its events', async () => {
    const { seats, cards, room, submit } = await started();
    const storeRevision = (await room()).revision;
    expect(await submit(seats[0]!, request('c1', 0, choose(cards[0]!)))).toEqual({ commandId: 'c1', acceptedRevision: 1 });
    const { room: after, revision } = await room();
    expect(revision).toBe(storeRevision + 1);
    expect(after.game!.state.revision).toBe(1);
    expect(after.game!.commands).toMatchObject([{ playerId: seats[0], commandId: 'c1', expectedRevision: 0, acceptedRevision: 1 }]);
    expect(after.game!.commands[0]!.events[0]).toMatchObject({ kind: 'role-selected', revision: 1 });
  });

  it('returns the saved result for a retry after a lost acknowledgement, even after later revisions', async () => {
    const { seats, cards, room, submit } = await started();
    const first = await submit(seats[0]!, request('c1', 0, choose(cards[0]!)));
    // Planter: every seat plants; the next revision exists before the retry arrives.
    await submit(seats[0]!, request('c2', 1, { kind: 'plant', choice: { kind: 'quarry' } }));
    const before = await room();
    expect(await submit(seats[0]!, request('c1', 0, choose(cards[0]!)))).toEqual(first);
    expect(await room()).toBe(before);
  });

  it('rejects the same ID with a different payload without executing it', async () => {
    const { seats, cards, room, submit } = await started();
    await submit(seats[0]!, request('c1', 0, choose(cards[0]!)));
    const before = await room();
    expect(await submit(seats[0]!, request('c1', 0, choose(cards[1]!)))).toEqual({ commandId: 'c1', code: 'COMMAND_ID_REUSE' });
    expect(await submit(seats[0]!, request('c1', 1, choose(cards[0]!)))).toEqual({ commandId: 'c1', code: 'COMMAND_ID_REUSE' });
    expect(await room()).toBe(before);
    // The key includes playerId: another seat's c1 is a new command (here an illegal one).
    expect(await submit(seats[1]!, request('c1', 1, choose(cards[1]!)))).toEqual({ commandId: 'c1', code: 'ILLEGAL_COMMAND', ruleId: 'ROLE-001' });
  });

  it('does not execute stale revisions', async () => {
    const { seats, cards, room, submit } = await started();
    await submit(seats[0]!, request('c1', 0, choose(cards[0]!)));
    const before = await room();
    expect(await submit(seats[0]!, request('c2', 0, { kind: 'plant', choice: { kind: 'quarry' } })))
      .toEqual({ commandId: 'c2', code: 'STALE_REVISION', currentRevision: 1 });
    expect(await room()).toBe(before);
  });

  it('serializes concurrent different actions so only one transition happens', async () => {
    const { seats, cards, room, submit } = await started();
    const results = await Promise.all([
      submit(seats[0]!, request('x', 0, choose(cards[0]!))),
      submit(seats[0]!, request('y', 0, choose(cards[1]!))),
      submit(seats[1]!, request('z', 0, choose(cards[2]!))),
    ]);
    expect(results).toEqual([
      { commandId: 'x', acceptedRevision: 1 },
      { commandId: 'y', code: 'STALE_REVISION', currentRevision: 1 },
      { commandId: 'z', code: 'STALE_REVISION', currentRevision: 1 },
    ]);
    const { room: after } = await room();
    expect(after.game!.state.revision).toBe(1);
    expect(after.game!.commands.map(c => c.commandId)).toEqual(['x']);
  });

  it('answers concurrent duplicates of one request with one transition', async () => {
    const { seats, cards, room, submit } = await started();
    const same = request('c1', 0, choose(cards[0]!));
    expect(await Promise.all([submit(seats[0]!, same), submit(seats[0]!, same)]))
      .toEqual([{ commandId: 'c1', acceptedRevision: 1 }, { commandId: 'c1', acceptedRevision: 1 }]);
    expect((await room()).room.game!.commands).toHaveLength(1);
  });

  it('returns engine rejections without writing', async () => {
    const { seats, cards, room, submit } = await started();
    const before = await room();
    expect(await submit(seats[1]!, request('c1', 0, choose(cards[0]!)))).toEqual({ commandId: 'c1', code: 'ILLEGAL_COMMAND', ruleId: 'ROLE-001' });
    expect(await room()).toBe(before);
  });

  it('never acknowledges a failed storage write, and a retry can still succeed', async () => {
    class FailingOnce extends InMemoryRoomStore {
      fail = false;
      override async update(room: Room, expectedRevision: number) {
        if (this.fail) { this.fail = false; throw Error('disk'); }
        return super.update(room, expectedRevision);
      }
    }
    const store = new FailingOnce();
    const { seats, cards, room, submit } = await started(store);
    const before = await room();
    store.fail = true;
    expect(await submit(seats[0]!, request('c1', 0, choose(cards[0]!)))).toEqual({ commandId: 'c1', code: 'STORE_UNAVAILABLE' });
    expect(await room()).toBe(before);
    expect(await submit(seats[0]!, request('c1', 0, choose(cards[0]!)))).toEqual({ commandId: 'c1', acceptedRevision: 1 });
  });

  it('rejects commands for unknown rooms and rooms still in the lobby', async () => {
    const store = new InMemoryRoomStore(), queues = new RoomQueues();
    const lobby = new Lobby(store, { id: () => 'id', roomCode: () => 'CODE', seed: () => 1, pick: () => 0 });
    const created = await lobby.createRoom('a');
    if (!created.ok) throw Error(created.code);
    const req = request('c1', 0, choose('role-1'));
    expect(await submitCommand(store, queues, 'missing', created.value.playerId, req, () => true)).toEqual({ commandId: 'c1', code: 'ROOM_CLOSED' });
    expect(await submitCommand(store, queues, created.value.roomId, created.value.playerId, req, () => true)).toEqual({ commandId: 'c1', code: 'ILLEGAL_COMMAND' });
  });
});

describe('room queue', () => {
  it('runs a room’s tasks one at a time in arrival order, continuing after a failure', async () => {
    const queues = new RoomQueues(), log: string[] = [];
    const task = (name: string, fail = false) => async () => {
      log.push(`start ${name}`);
      await new Promise(resolve => setTimeout(resolve, 5));
      log.push(`end ${name}`);
      if (fail) throw Error(name);
      return name;
    };
    const results = await Promise.allSettled([queues.run('r', task('a')), queues.run('r', task('b', true)), queues.run('r', task('c'))]);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled']);
    expect(log).toEqual(['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
  });
});
