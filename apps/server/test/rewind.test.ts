import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { GameplayRequest } from '@vibe-rico/protocol';
import { RoomQueues } from '../src/commands/queue.js';
import { submitCommand } from '../src/commands/submit.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { Lobby } from '../src/rooms/lobby.js';
import { rewindRole } from '../src/rooms/rewind.js';

async function started() {
  let n = 0;
  const store = new InMemoryRoomStore(), queues = new RoomQueues();
  const lobby = new Lobby(store, { id: () => `id-${++n}`, roomCode: () => `CODE${n}`, seed: () => 7, pick: () => 0 });
  const created = await lobby.createRoom('a');
  if (!created.ok) throw Error(created.code);
  const seats: PlayerId[] = [created.value.playerId];
  for (const name of ['b', 'c']) { const j = await lobby.joinRoom(created.value.roomCode, name); if (!j.ok) throw Error(j.code); seats.push(j.value.playerId); }
  await lobby.startGame(created.value.roomId, seats[0]!);
  const roomId = created.value.roomId;
  const game = async () => (await store.get(roomId))!.room.game!;
  let id = 0;
  const submit = async (playerId: PlayerId, action: GameplayRequest['action']) =>
    submitCommand(store, queues, roomId, playerId, { protocolVersion: PROTOCOL_VERSION, roomId, commandId: `c${++id}`, expectedRevision: (await game()).state.revision, action }, () => true);
  const card = async (kind: string) => (await game()).state.roleCards.find(c => c.kind === kind)!.instanceId;
  return { store, roomId, seats, game, submit, card };
}

describe('rewinding a role choice', () => {
  it('takes back the chooser’s role, bonus coins and turn while nothing has followed it', async () => {
    const { store, roomId, seats, game, submit, card } = await started();
    const before = (await game()).state;
    await submit(seats[0]!, { kind: 'choose-role', roleCardId: await card('builder') });
    expect((await game()).state.phase.kind).toBe('builder-choice');
    const rewound = await rewindRole(store, roomId, seats[0]!);
    expect(rewound.ok).toBe(true);
    expect((await game()).state).toEqual(before);
    expect((await game()).commands).toHaveLength(0);
    // The turn is the chooser's again, and a different role can be taken.
    expect(await submit(seats[0]!, { kind: 'choose-role', roleCardId: await card('trader') })).toMatchObject({ acceptedRevision: 1 });
  });

  it('refuses once the choice has a follow-up, for another player, or without a role choice', async () => {
    const { store, roomId, seats, submit, card } = await started();
    expect(await rewindRole(store, roomId, seats[0]!)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    await submit(seats[0]!, { kind: 'choose-role', roleCardId: await card('builder') });
    expect(await rewindRole(store, roomId, seats[1]!)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    await submit(seats[0]!, { kind: 'build', purchase: null });
    expect(await rewindRole(store, roomId, seats[0]!)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
  });
});
