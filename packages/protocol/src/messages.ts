import type { PlayerEvent, PlayerLegalActions, PlayerView } from './views.js';

/** PROTOCOL.md "Envelope": per-player broadcast built from one projection, never full GameState. */
export interface PlayerBroadcast {
  readonly protocolVersion: string;
  readonly revision: number;
  readonly view: PlayerView;
  readonly legalActions: PlayerLegalActions;
  readonly events: readonly PlayerEvent[];
}
/** Server → room channel `room-state`: who is seated. Display names are public; tokens never appear. */
export interface RoomState {
  readonly roomCode: string;
  readonly hostPlayerId: string;
  readonly seats: readonly { readonly playerId: string; readonly displayName: string }[];
  readonly started: boolean;
}
/** Acknowledgement for room and resume requests. */
export type RoomReply<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: ProtocolErrorCode };
/** create-room / join-room: the reconnect token is sent once, only to its owner. */
export interface SeatGranted { readonly roomId: string; readonly roomCode: string; readonly playerId: string; readonly token: string }
/** resume: the seat and the revision current when the connection subscribed (null before start). */
export interface Resumed { readonly playerId: string; readonly revision: number | null }
export interface CommandAccepted {
  readonly commandId: string;
  readonly acceptedRevision: number;
}
export type ProtocolErrorCode =
  | 'BAD_SCHEMA' | 'UNAUTHORIZED' | 'STALE_SESSION' | 'STALE_REVISION' | 'ILLEGAL_COMMAND'
  | 'COMMAND_ID_REUSE' | 'ROOM_CLOSED' | 'STORE_UNAVAILABLE' | 'VERSION_MISMATCH'
  // Join failures, distinguished for the lobby (user ruling 2026-10-01).
  | 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'GAME_STARTED';
/**
 * Sent only to the submitter. No engine message text, so errors cannot describe hidden state.
 * commandId is null only for BAD_SCHEMA / VERSION_MISMATCH requests without a string commandId.
 */
export interface CommandRejected {
  readonly commandId: string | null;
  readonly code: ProtocolErrorCode;
  readonly ruleId?: string;
  readonly currentRevision?: number;
}
