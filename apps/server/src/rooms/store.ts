import type { GameEvent, GameState, PlayerId } from '@vibe-rico/game-engine';
import type { PlayerAction } from '@vibe-rico/protocol';

export interface Seat {
  readonly playerId: PlayerId;
  readonly displayName: string;
  /** SHA-256 of the seat's reconnect token; the token itself is never stored. */
  readonly tokenHash: string;
}
export interface Room {
  readonly roomId: string;
  /** Locates an invited room; not a player credential (PROTOCOL.md "Rooms and recovery"). */
  readonly roomCode: string;
  readonly hostPlayerId: PlayerId;
  /** Join order; fixed as the clockwise seat order at start. */
  readonly seats: readonly Seat[];
  /**
   * Null in the lobby. SETUP-001: the server records the seed with the started game. `commands` is the
   * accepted history owned by the store, not GameState (ARCHITECTURE "Engineering standards").
   */
  readonly game: {
    readonly seed: number;
    /** Start-of-game snapshot; with `commands` it is the replay history (GAME_STATE "Visibility and replay"). */
    readonly initialState: GameState;
    readonly state: GameState;
    readonly commands: readonly AcceptedCommand[];
  } | null;
}
/** PROTOCOL.md step 6: the success result and its events, keyed by (gameId, playerId, commandId). */
export interface AcceptedCommand {
  readonly playerId: PlayerId;
  readonly commandId: string;
  readonly expectedRevision: number;
  readonly action: PlayerAction;
  readonly acceptedRevision: number;
  readonly events: readonly GameEvent[];
}
export interface StoredRoom { readonly room: Room; readonly revision: number }

/** Storage boundary; PostgreSQL replaces the in-memory store later (ARCHITECTURE "Storage and release"). */
export interface RoomStore {
  /** Inserts at revision 0; false when the roomId or roomCode is already taken. */
  create(room: Room): Promise<boolean>;
  get(roomId: string): Promise<StoredRoom | undefined>;
  findByCode(roomCode: string): Promise<StoredRoom | undefined>;
  /** Writes only when the stored revision equals expectedRevision, then increments it. */
  update(room: Room, expectedRevision: number): Promise<'ok' | 'stale'>;
  /** Removes the room and frees its code, under the same expectedRevision contract. */
  delete(roomId: string, expectedRevision: number): Promise<'ok' | 'stale'>;
}
