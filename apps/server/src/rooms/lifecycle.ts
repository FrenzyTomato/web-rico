import type { PlayerId } from '@vibe-rico/game-engine';
import type { RoomQueues } from '../commands/queue.js';
import type { LobbyResult } from './lobby.js';
import { LIMITS } from './limits.js';
import type { RoomStore } from './store.js';

/**
 * Pregame leaving, host transfer/closure, connection presence and empty-room cleanup (PR-040).
 * Store changes run in the room queue, ordered with commands (PROTOCOL.md step 2).
 */
export class RoomLifecycle {
  /** In-memory presence: which seated players have a live connection, and since when a room is empty. */
  readonly #presence = new Map<string, { connected: Set<PlayerId>; emptySince: number | null }>();

  constructor(private readonly store: RoomStore, private readonly queues: RoomQueues,
    private readonly now: () => number = Date.now, private readonly emptyRoomTtlMs: number = LIMITS.emptyRoomTtlMs) {}

  /** Before start only; seats are fixed afterwards. A departing host passes to the next seat; the last leaver removes the room. */
  leave(roomId: string, playerId: PlayerId): Promise<LobbyResult<null>> {
    return this.queues.run(roomId, async () => {
      const stored = await this.store.get(roomId);
      if (!stored) return { ok: false, code: 'ROOM_CLOSED' };
      const { room, revision } = stored;
      if (room.game !== null || !room.seats.some(s => s.playerId === playerId)) return { ok: false, code: 'ILLEGAL_COMMAND' };
      const seats = room.seats.filter(s => s.playerId !== playerId);
      const written = seats.length === 0 ? await this.store.delete(roomId, revision)
        : await this.store.update({ ...room, seats, hostPlayerId: room.hostPlayerId === playerId ? seats[0]!.playerId : room.hostPlayerId }, revision);
      if (written === 'stale') return { ok: false, code: 'STALE_REVISION' };
      if (seats.length === 0) this.#presence.delete(roomId); else this.disconnected(roomId, playerId);
      return { ok: true, value: null };
    });
  }

  /** Host only, before or during a game. An explicit lifecycle action, not a game ending. */
  close(roomId: string, requesterId: PlayerId): Promise<LobbyResult<null>> {
    return this.queues.run(roomId, async () => {
      const stored = await this.store.get(roomId);
      if (!stored) return { ok: false, code: 'ROOM_CLOSED' };
      if (stored.room.hostPlayerId !== requesterId) return { ok: false, code: 'UNAUTHORIZED' };
      if (await this.store.delete(roomId, stored.revision) === 'stale') return { ok: false, code: 'STALE_REVISION' };
      this.#presence.delete(roomId);
      return { ok: true, value: null };
    });
  }

  /** After a restart nobody is connected: treat a stored room as empty since now (PR-058). */
  recovered(roomId: string): void {
    if (!this.#presence.has(roomId)) this.#presence.set(roomId, { connected: new Set(), emptySince: this.now() });
  }

  /** Connection events change presence only; a disconnected player keeps their seat. */
  connected(roomId: string, playerId: PlayerId): void {
    const p = this.#presence.get(roomId) ?? { connected: new Set<PlayerId>(), emptySince: null };
    p.connected.add(playerId);
    p.emptySince = null;
    this.#presence.set(roomId, p);
  }
  disconnected(roomId: string, playerId: PlayerId): void {
    const p = this.#presence.get(roomId);
    if (!p) return;
    p.connected.delete(playerId);
    if (p.connected.size === 0 && p.emptySince === null) p.emptySince = this.now();
  }

  /** Removes rooms empty for at least the TTL. Rooms with any connected player are never removed. */
  async sweep(): Promise<void> {
    const cutoff = this.now() - this.emptyRoomTtlMs;
    const expired = (p: { emptySince: number | null } | undefined) => p !== undefined && p.emptySince !== null && p.emptySince <= cutoff;
    for (const [roomId, p] of this.#presence) {
      if (!expired(p)) continue;
      await this.queues.run(roomId, async () => {
        // A player may have reconnected while this task waited in the queue.
        if (!expired(this.#presence.get(roomId))) return;
        const stored = await this.store.get(roomId);
        if (!stored || await this.store.delete(roomId, stored.revision) === 'ok') this.#presence.delete(roomId);
      });
    }
  }
}
