import type { PlayerId } from '@vibe-rico/game-engine';
import type { RoomStore } from '../rooms/store.js';
import { hashToken } from './tokens.js';

/** One active controlling connection per seat, versioned by sessionGeneration (PROTOCOL.md "Rooms and recovery"). */
export class Sessions {
  readonly #controllers = new Map<string, Map<PlayerId, { generation: number; socketId: string }>>();

  constructor(private readonly store: RoomStore) {}

  /** The seat whose stored hash matches, within this room only. */
  async authenticate(roomId: string, token: string): Promise<PlayerId | undefined> {
    const tokenHash = hashToken(token);
    return (await this.store.get(roomId))?.room.seats.find(s => s.tokenHash === tokenHash)?.playerId;
  }

  /** Makes socketId the seat's controller; returns the new generation and the replaced connection, if any. */
  take(roomId: string, playerId: PlayerId, socketId: string): { generation: number; replacedSocketId: string | undefined } {
    const seats = this.#controllers.get(roomId) ?? new Map<PlayerId, { generation: number; socketId: string }>();
    this.#controllers.set(roomId, seats);
    const previous = seats.get(playerId);
    const generation = (previous?.generation ?? 0) + 1;
    seats.set(playerId, { generation, socketId });
    return { generation, replacedSocketId: previous?.socketId };
  }

  isCurrent(roomId: string, playerId: PlayerId, generation: number): boolean {
    return this.#controllers.get(roomId)?.get(playerId)?.generation === generation;
  }

  /** True when socketId was still the controller, i.e. the seat is now disconnected. */
  release(roomId: string, playerId: PlayerId, socketId: string): boolean {
    return this.#controllers.get(roomId)?.get(playerId)?.socketId === socketId;
  }
}
