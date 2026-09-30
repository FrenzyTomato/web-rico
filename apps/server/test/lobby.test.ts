import { describe, expect, it } from 'vitest';
import { createGame, createId, RULESET } from '@vibe-rico/game-engine';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';
import { cryptoRandom, Lobby } from '../src/rooms/lobby.js';
import type { LobbyRandom } from '../src/rooms/lobby.js';

function fixed(codes: string[]): LobbyRandom & { codeCalls: () => number } {
  let n = 0, calls = 0;
  return { id: () => `id-${++n}`, roomCode: () => { calls++; return codes.shift() ?? `CODE${calls}`; }, seed: () => 1897,
    pick: count => count - 2, codeCalls: () => calls };
}
async function room(size: number, random: LobbyRandom = fixed([])) {
  const store = new InMemoryRoomStore(), lobby = new Lobby(store, random);
  const created = await lobby.createRoom('host');
  if (!created.ok) throw Error(created.code);
  const joined = [];
  for (let i = 1; i < size; i++) {
    const r = await lobby.joinRoom(created.value.roomCode, `p${i}`);
    if (!r.ok) throw Error(r.code);
    joined.push(r.value.playerId);
  }
  return { store, lobby, ...created.value, seats: [created.value.playerId, ...joined] };
}

describe('lobby', () => {
  it('retries room-code collisions with a fresh code', async () => {
    const random = fixed(['AAAAAA', 'AAAAAA', 'BBBBBB']);
    const store = new InMemoryRoomStore(), lobby = new Lobby(store, random);
    expect(await lobby.createRoom('a')).toMatchObject({ ok: true, value: { roomCode: 'AAAAAA' } });
    expect(await lobby.createRoom('b')).toMatchObject({ ok: true, value: { roomCode: 'BBBBBB' } });
    expect(random.codeCalls()).toBe(3);
    expect((await store.findByCode('AAAAAA'))!.room.seats.map(s => s.displayName)).toEqual(['a']);
  });

  it('generates six-character invitation codes and in-range Governor picks', () => {
    for (let i = 0; i < 20; i++) expect(cryptoRandom.roomCode()).toMatch(/^[A-Z0-9]{6}$/);
    for (let i = 0; i < 20; i++) expect([0, 1, 2]).toContain(cryptoRandom.pick(3));
  });

  it('seats at most five players and starts only with three to five', async () => {
    const full = await room(5);
    expect(await full.lobby.joinRoom(full.roomCode, 'sixth')).toEqual({ ok: false, code: 'ROOM_FULL' });
    expect((await full.store.get(full.roomId))!.room.seats).toHaveLength(5);
    expect(await full.lobby.startGame(full.roomId, full.playerId)).toEqual({ ok: true, value: null });
    const two = await room(2);
    expect(await two.lobby.startGame(two.roomId, two.playerId)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    expect((await two.store.get(two.roomId))!.room.game).toBeNull();
    const three = await room(3);
    expect(await three.lobby.startGame(three.roomId, three.playerId)).toEqual({ ok: true, value: null });
  });

  it('keeps duplicate display names distinct from player identity', async () => {
    const { store, lobby, roomId, roomCode } = await room(1);
    const a = await lobby.joinRoom(roomCode, 'Ana'), b = await lobby.joinRoom(roomCode, 'Ana');
    if (!a.ok || !b.ok) throw Error('join failed');
    expect(a.value.playerId).not.toBe(b.value.playerId);
    expect((await store.get(roomId))!.room.seats.filter(s => s.displayName === 'Ana').map(s => s.playerId))
      .toEqual([a.value.playerId, b.value.playerId]);
  });

  it('rejects starts by anyone but the host without writing', async () => {
    const { store, lobby, roomId, seats } = await room(3);
    const before = await store.get(roomId);
    expect(await lobby.startGame(roomId, seats[1]!)).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await lobby.startGame(roomId, createId('player', 'stranger'))).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await store.get(roomId)).toBe(before);
  });

  it('starts with fixed seats, a randomly picked Governor and a recorded seed; rejects new seats afterwards', async () => {
    const { store, lobby, roomId, roomCode, playerId, seats } = await room(4);
    expect(await lobby.startGame(roomId, playerId)).toEqual({ ok: true, value: null });
    const started = (await store.get(roomId))!;
    const expected = createGame({ rulesetId: RULESET.id, gameId: createId('game', roomId), seatOrder: seats, governorPlayerId: seats[2]!, seed: 1897 });
    if (!expected.ok) throw Error(expected.error.message);
    expect(started.room.game).toEqual({ seed: 1897, initialState: expected.state, state: expected.state, commands: [] });
    expect(await lobby.joinRoom(roomCode, 'late')).toEqual({ ok: false, code: 'GAME_STARTED' });
    expect(await lobby.startGame(roomId, playerId)).toEqual({ ok: false, code: 'ILLEGAL_COMMAND' });
    expect(await store.get(roomId)).toBe(started);
  });

  it('rejects unknown room codes', async () => {
    const { lobby } = await room(1);
    expect(await lobby.joinRoom('NOPE00', 'x')).toEqual({ ok: false, code: 'ROOM_NOT_FOUND' });
  });

  it('follows the expectedRevision contract', async () => {
    const { store, lobby, roomId, roomCode } = await room(1);
    // Both joins read revision 0; the first write wins and the second is stale.
    const [a, b] = await Promise.all([lobby.joinRoom(roomCode, 'a'), lobby.joinRoom(roomCode, 'b')]);
    expect([a.ok, b]).toEqual([true, { ok: false, code: 'STALE_REVISION' }]);
    const stored = (await store.get(roomId))!;
    expect(stored.revision).toBe(1);
    expect(stored.room.seats.map(s => s.displayName)).toEqual(['host', 'a']);
    expect(await store.update(stored.room, 0)).toBe('stale');
    expect(await store.update(stored.room, 1)).toBe('ok');
    expect((await store.get(roomId))!.revision).toBe(2);
  });
});
