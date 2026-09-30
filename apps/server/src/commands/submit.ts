import { isDeepStrictEqual } from 'node:util';
import { applyCommand } from '@vibe-rico/game-engine';
import type { GameCommand, GameEvent, GameState, PlayerId } from '@vibe-rico/game-engine';
import type { CommandAccepted, CommandRejected, GameplayRequest } from '@vibe-rico/protocol';
import type { RoomStore } from '../rooms/store.js';
import type { RoomQueues } from './queue.js';

/**
 * PROTOCOL.md "Command processing order" steps 2–7. The caller has done step 1: the request passed
 * schema/version checks and roomId/playerId come from the authenticated session, not the client.
 */
export function submitCommand(store: RoomStore, queues: RoomQueues, roomId: string, playerId: PlayerId,
  request: GameplayRequest, isCurrentSession: () => boolean,
  onCommitted: (state: GameState, events: readonly GameEvent[]) => Promise<void> = async () => {}): Promise<CommandAccepted | CommandRejected> {
  const { commandId, expectedRevision, action } = request;
  return queues.run(roomId, async () => {
    // Step 2: session and room lifecycle inside the queue.
    if (!isCurrentSession()) return { commandId, code: 'STALE_SESSION' };
    const stored = await store.get(roomId);
    if (!stored) return { commandId, code: 'ROOM_CLOSED' };
    const { room, revision } = stored;
    if (room.game === null) return { commandId, code: 'ILLEGAL_COMMAND' };
    const game = room.game;
    // Step 3: (gameId, playerId, commandId); a room holds one game, so its history is scoped to that gameId.
    const saved = game.commands.find(c => c.playerId === playerId && c.commandId === commandId);
    if (saved) {
      return isDeepStrictEqual({ expectedRevision: saved.expectedRevision, action: saved.action }, { expectedRevision, action })
        ? { commandId, acceptedRevision: saved.acceptedRevision } : { commandId, code: 'COMMAND_ID_REUSE' };
    }
    // Step 4.
    if (expectedRevision !== game.state.revision) return { commandId, code: 'STALE_REVISION', currentRevision: game.state.revision };
    // Step 5: identity is attached by the server.
    const result = applyCommand(game.state, { ...action, actorId: playerId } as GameCommand);
    if (!result.ok) return { commandId, code: 'ILLEGAL_COMMAND', ruleId: result.error.ruleId };
    // Step 6: snapshot, success result and events in one write against the read revision.
    const accepted = { playerId, commandId, expectedRevision, action, acceptedRevision: result.state.revision, events: result.events };
    let written: 'ok' | 'stale';
    try {
      written = await store.update({ ...room, game: { ...game, state: result.state, commands: [...game.commands, accepted] } }, revision);
    } catch {
      return { commandId, code: 'STORE_UNAVAILABLE' };
    }
    // Another writer changed the room after the read; its current revision is unknown here.
    if (written === 'stale') return { commandId, code: 'STALE_REVISION' };
    // Step 7: broadcast player views inside the queue, so broadcasts follow commit order; then acknowledge.
    await onCommitted(result.state, result.events);
    return { commandId, acceptedRevision: result.state.revision };
  });
}
