import type { PlayerEvent, PlayerLegalActions, PlayerView } from './views.js';

/** PROTOCOL.md "Envelope": per-player broadcast built from one projection, never full GameState. */
export interface PlayerBroadcast {
  readonly protocolVersion: string;
  readonly revision: number;
  readonly view: PlayerView;
  readonly legalActions: PlayerLegalActions;
  readonly events: readonly PlayerEvent[];
}
export interface CommandAccepted {
  readonly commandId: string;
  readonly acceptedRevision: number;
}
export type ProtocolErrorCode =
  | 'BAD_SCHEMA' | 'UNAUTHORIZED' | 'STALE_SESSION' | 'STALE_REVISION' | 'ILLEGAL_COMMAND'
  | 'COMMAND_ID_REUSE' | 'ROOM_CLOSED' | 'STORE_UNAVAILABLE' | 'VERSION_MISMATCH';
/** Sent only to the submitter. No engine message text, so errors cannot describe hidden state. */
export interface CommandRejected {
  readonly commandId: string;
  readonly code: ProtocolErrorCode;
  readonly ruleId?: string;
  readonly currentRevision?: number;
}
