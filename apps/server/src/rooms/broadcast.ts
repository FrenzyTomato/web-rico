import type { Server } from 'socket.io';
import { getLegalCommands } from '@vibe-rico/game-engine';
import type { GameEvent, GameState, PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { PlayerBroadcast, RoomState } from '@vibe-rico/protocol';
import type { Room } from './store.js';
import { eventsForPlayer } from '../projection/playerEvents.js';
import { projectForPlayer } from '../projection/playerView.js';

/** One seat's `state` message: its own view, legal actions (empty unless it decides) and filtered events. */
export function broadcastFor(state: GameState, events: readonly GameEvent[], playerId: PlayerId): PlayerBroadcast {
  return { protocolVersion: PROTOCOL_VERSION, revision: state.revision, view: projectForPlayer(state, playerId),
    legalActions: getLegalCommands(state, playerId), events: eventsForPlayer(events, playerId) };
}

/**
 * PROTOCOL.md step 7: every connection in the room channel is its seat's current controller (replaced
 * connections leave the channel), and each receives only its own projection. Never full GameState.
 */
export async function broadcast(io: Server, roomId: string, state: GameState, events: readonly GameEvent[]): Promise<void> {
  for (const socket of await io.in(roomId).fetchSockets()) {
    const playerId = (socket.data as { session?: { playerId: PlayerId } }).session?.playerId;
    if (playerId) socket.emit('state', broadcastFor(state, events, playerId));
  }
}

/** Lobby seat list for the room channel; seats are copied field by field so token hashes stay server-side. */
export function roomState(room: Room): RoomState {
  return { roomCode: room.roomCode, hostPlayerId: room.hostPlayerId,
    seats: room.seats.map(s => ({ playerId: s.playerId, displayName: s.displayName })), started: room.game !== null };
}
