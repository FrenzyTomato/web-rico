import { randomInt, randomUUID } from 'node:crypto';
import { createGame, createId, RULESET } from '@vibe-rico/game-engine';
import type { PlayerId } from '@vibe-rico/game-engine';
import type { ProtocolErrorCode } from '@vibe-rico/protocol';
import { issueToken } from '../sessions/tokens.js';
import type { Room, RoomStore } from './store.js';

const MAX_SEATS = 5;
const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const CODE_LENGTH = 6;

/** Randomness sources, injectable so tests can force collisions and fixed seeds. */
export interface LobbyRandom {
  readonly id: () => string;
  readonly roomCode: () => string;
  readonly seed: () => number;
  /** Uniform index in 0…count-1; chooses the initial Governor. */
  readonly pick: (count: number) => number;
}
export const cryptoRandom: LobbyRandom = {
  id: () => randomUUID(),
  roomCode: () => Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(''),
  seed: () => randomInt(0x100000000),
  pick: count => randomInt(count),
};
export type LobbyResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: ProtocolErrorCode };
const fail = (code: ProtocolErrorCode) => ({ ok: false, code }) as const;

export class Lobby {
  constructor(private readonly store: RoomStore, private readonly random: LobbyRandom = cryptoRandom) {}

  /** The creator is the host and first seat. Code collisions retry with a fresh code. The token is returned once. */
  async createRoom(displayName: string): Promise<LobbyResult<{ roomId: string; roomCode: string; playerId: PlayerId; token: string }>> {
    const playerId = createId('player', this.random.id());
    const { token, tokenHash } = issueToken();
    for (;;) {
      const room: Room = { roomId: this.random.id(), roomCode: this.random.roomCode(), hostPlayerId: playerId,
        seats: [{ playerId, displayName, tokenHash }], game: null };
      if (await this.store.create(room)) return { ok: true, value: { roomId: room.roomId, roomCode: room.roomCode, playerId, token } };
    }
  }

  /** Display names may repeat; identity is the server-generated playerId. */
  async joinRoom(roomCode: string, displayName: string): Promise<LobbyResult<{ roomId: string; playerId: PlayerId; token: string }>> {
    const stored = await this.store.findByCode(roomCode);
    if (!stored) return fail('ROOM_NOT_FOUND');
    const { room, revision } = stored;
    if (room.game !== null) return fail('GAME_STARTED');
    if (room.seats.length >= MAX_SEATS) return fail('ROOM_FULL');
    const playerId = createId('player', this.random.id());
    const { token, tokenHash } = issueToken();
    const next: Room = { ...room, seats: [...room.seats, { playerId, displayName, tokenHash }] };
    if (await this.store.update(next, revision) === 'stale') return fail('STALE_REVISION');
    return { ok: true, value: { roomId: room.roomId, playerId, token } };
  }

  /**
   * Host only. Seats are fixed clockwise in join order and the Governor is a random seat (SETUP-001: the
   * server selects and records both, with the seed; user ruling 2026-10-01). createGame enforces 3–5 players.
   */
  async startGame(roomId: string, requesterId: PlayerId): Promise<LobbyResult<null>> {
    const stored = await this.store.get(roomId);
    if (!stored) return fail('ROOM_CLOSED');
    const { room, revision } = stored;
    if (room.hostPlayerId !== requesterId) return fail('UNAUTHORIZED');
    if (room.game !== null) return fail('ILLEGAL_COMMAND');
    const seatOrder = room.seats.map(s => s.playerId);
    const seed = this.random.seed();
    const created = createGame({ rulesetId: RULESET.id, gameId: createId('game', room.roomId), seatOrder,
      governorPlayerId: seatOrder[this.random.pick(seatOrder.length)]!, seed });
    if (!created.ok) return fail('ILLEGAL_COMMAND');
    if (await this.store.update({ ...room, game: { seed, initialState: created.state, state: created.state, commands: [] } }, revision) === 'stale') return fail('STALE_REVISION');
    return { ok: true, value: null };
  }
}
