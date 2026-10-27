import { describe, expect, it } from 'vitest';
import { getLegalCommands } from '@vibe-rico/game-engine';
import type { PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION, parseRoomRequest } from '@vibe-rico/protocol';
import { BotRunner } from '../../src/bots/runner.js';
import { RoomQueues } from '../../src/commands/queue.js';
import { submitCommand } from '../../src/commands/submit.js';
import { roomState } from '../../src/rooms/broadcast.js';
import { InMemoryRoomStore } from '../../src/rooms/inMemoryStore.js';
import { RoomLifecycle } from '../../src/rooms/lifecycle.js';
import { Lobby } from '../../src/rooms/lobby.js';
import { FakeClient } from './helpers.js';

async function hosted() {
  let n = 0;
  const store = new InMemoryRoomStore(), queues = new RoomQueues();
  const lobby = new Lobby(store, { id: () => `id-${++n}`, roomCode: () => `CODE${n}`, seed: () => 7, pick: () => 0 });
  const created = await lobby.createRoom('host');
  if (!created.ok) throw Error(created.code);
  const room = async () => (await store.get(created.value.roomId))!.room;
  return { store, queues, lobby, room, roomId: created.value.roomId, host: created.value.playerId, roomCode: created.value.roomCode };
}

describe('bot seats in the lobby', () => {
  it('lets only the host add, fill and remove bots before start', async () => {
    const { lobby, room, roomId, host, roomCode } = await hosted();
    const guest = await lobby.joinRoom(roomCode, 'guest');
    if (!guest.ok) throw Error(guest.code);
    expect(await lobby.addBot(roomId, guest.value.playerId)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await lobby.fillBots(roomId, host, 4)).toEqual({ ok: true, value: null });
    expect((await room()).seats.map(s => s.displayName)).toEqual(['host', 'guest', 'Bot Ana', 'Bot Bea']);
    expect(await lobby.addBot(roomId, host)).toEqual({ ok: true, value: null });
    expect(await lobby.addBot(roomId, host)).toEqual({ ok: false, code: 'ROOM_FULL' });
    const bot = (await room()).seats.find(s => s.bot)!;
    expect(await lobby.removeBot(roomId, host, guest.value.playerId)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    expect(await lobby.removeBot(roomId, host, bot.playerId)).toEqual({ ok: true, value: null });
    expect((await room()).seats).toHaveLength(4);
    expect(await lobby.startGame(roomId, host)).toEqual({ ok: true, value: null });
    expect(await lobby.addBot(roomId, host)).toEqual({ ok: false, code: 'GAME_STARTED' });
  });

  it('marks bots in the public seat list without strategies or token hashes', async () => {
    const { lobby, room, roomId, host } = await hosted();
    await lobby.fillBots(roomId, host, 3);
    const seats = roomState(await room()).seats;
    expect(seats.map(s => s.bot ?? false)).toEqual([false, true, true]);
    expect(JSON.stringify(seats)).not.toMatch(/token|strategy/i);
  });

  it('closes the room when the last human leaves, since bots cannot host', async () => {
    const { store, queues, lobby, roomId, host } = await hosted();
    await lobby.fillBots(roomId, host, 3);
    expect(await new RoomLifecycle(store, queues).leave(roomId, host)).toEqual({ ok: true, value: null });
    expect(await store.get(roomId)).toBeUndefined();
  });

  it('accepts the new room requests and rejects bad seat counts', () => {
    const parse = (action: unknown) => parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action }).ok;
    expect(parse({ kind: 'add-bot', roomId: 'r' })).toBe(true);
    expect(parse({ kind: 'fill-bots', roomId: 'r', seats: 3 })).toBe(true);
    expect(parse({ kind: 'fill-bots', roomId: 'r', seats: 9 })).toBe(false);
    expect(parse({ kind: 'remove-bot', roomId: 'r', playerId: 'p' })).toBe(true);
  });
});

describe('bot runner', () => {
  it('plays bot turns after a human move and hands the turn back', async () => {
    const { store, queues, lobby, room, roomId, host } = await hosted();
    await lobby.fillBots(roomId, host, 3);
    await lobby.startGame(roomId, host);
    const commits: number[] = [];
    const client = new FakeClient();
    const runner: BotRunner = new BotRunner(store, queues, async (id, state) => { commits.push(state.revision); runner.kick(id); }, { client, delayMs: 0 });
    const state = async () => (await room()).game!.state;
    const humanTurn = async () => getLegalCommands(await state(), host).length > 0;
    // The host is Governor (pick() = 0) and chooses first; then both bots choose and act until the host is asked again.
    const s = await state();
    const card = s.roleCards.find(c => c.kind === 'trader')!;
    const r = await submitCommand(store, queues, roomId, host, { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'h1', expectedRevision: s.revision,
      action: { kind: 'choose-role', roleCardId: card.instanceId } }, () => true, async (_s) => runner.kick(roomId));
    expect(r).toMatchObject({ acceptedRevision: 1 });
    await expect.poll(async () => (await state()).revision > 1 && await humanTurn(), { timeout: 10_000 }).toBe(true);
    const bots = (await room()).seats.filter(x => x.bot).map(x => x.playerId as PlayerId);
    const played = (await room()).game!.commands.filter(c => bots.includes(c.playerId));
    expect(played.length).toBeGreaterThan(0);
    expect(client.calls).toBeGreaterThan(0);
    runner.stop();
  });

  it('plays an all-bot room to the end through the store', async () => {
    const { store, queues, lobby, room, roomId, host } = await hosted();
    await lobby.fillBots(roomId, host, 3);
    // The host stays seated but this test seats bots in their place for the game itself.
    const r = await room();
    await store.update({ ...r, seats: r.seats.map(s => ({ ...s, bot: true as const })) }, (await store.get(roomId))!.revision);
    await lobby.startGame(roomId, host);
    const runner: BotRunner = new BotRunner(store, queues, async id => runner.kick(id), { client: null, delayMs: 0 });
    runner.kick(roomId);
    await expect.poll(async () => (await room()).game!.state.phase.kind, { timeout: 60_000, interval: 200 }).toBe('game-over');
    runner.stop();
  }, 70_000);
});
