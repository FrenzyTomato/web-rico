import { createReplay, replay, serializeGame } from '@vibe-rico/game-engine';
import type { GameCommand, PlayerId, ReplayFailure, ReplayRecord } from '@vibe-rico/game-engine';
import type { AcceptedCommand, RoomStore } from '../rooms/store.js';

/**
 * Local-development scenario tools (ARCHITECTURE "Presentation boundaries"): full private state, so the server
 * registers them only when started with dev tools enabled, and only for a seated player's own room.
 */
export type ExportResult = { ok: true; value: { replay: ReplayRecord; snapshot: string } } | { ok: false; code: 'ILLEGAL_COMMAND' };
export async function exportRoom(store: RoomStore, roomId: string): Promise<ExportResult> {
  const game = (await store.get(roomId))?.room.game;
  if (!game) return { ok: false, code: 'ILLEGAL_COMMAND' };
  const commands = game.commands.map(c => ({ ...c.action, actorId: c.playerId }) as GameCommand);
  return { ok: true, value: { replay: createReplay(game.initialState, commands, game.seed), snapshot: serializeGame(game.state) } };
}

export type ImportResult =
  | { ok: true; value: { revision: number } }
  | { ok: false; code: 'ILLEGAL_COMMAND' | 'STALE_REVISION' }
  | { ok: false; failure: ReplayFailure };
/**
 * Replaces the room's game with a validated replay (fixture import). `replay()` rejects damaged snapshots
 * and names the first rejected command's index; nothing is written unless the whole history applies.
 * The imported seats must be exactly the room's seats, since sessions and views are keyed by player ID.
 */
export async function importRoom(store: RoomStore, roomId: string, record: unknown): Promise<ImportResult> {
  const stored = await store.get(roomId);
  if (!stored?.room.game) return { ok: false, code: 'ILLEGAL_COMMAND' };
  const result = replay(record);
  if (!result.ok) return { ok: false, failure: result.failure };
  const seats = new Set<string>(stored.room.seats.map(s => s.playerId));
  if (result.initialState.seatOrder.length !== seats.size || !result.initialState.seatOrder.every(id => seats.has(id))) {
    return { ok: false, code: 'ILLEGAL_COMMAND' };
  }
  const commands = (record as { commands: GameCommand[] }).commands;
  const history: AcceptedCommand[] = commands.map(({ actorId, ...action }, i) => ({
    playerId: actorId as PlayerId, commandId: `import-${i}`, expectedRevision: result.initialState.revision + i,
    action: action as AcceptedCommand['action'], acceptedRevision: result.initialState.revision + i + 1, events: result.events[i]!,
  }));
  const seed = (record as { seed: number | null }).seed ?? stored.room.game.seed;
  const written = await store.update({ ...stored.room, game: { seed, initialState: result.initialState, state: result.state, commands: history } }, stored.revision);
  return written === 'ok' ? { ok: true, value: { revision: result.state.revision } } : { ok: false, code: 'STALE_REVISION' };
}
