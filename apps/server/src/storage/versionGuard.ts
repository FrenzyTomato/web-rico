import { deserializeGame, SnapshotError } from '@vibe-rico/game-engine';
import type { GameState } from '@vibe-rico/game-engine';

/** A stored game this server cannot run; the room is isolated and its data left untouched (PR-059). */
export class IncompatibleSave extends Error {
  constructor(readonly roomId: string, readonly path: string) { super(`incompatible save in room ${roomId} at ${path}`); this.name = 'IncompatibleSave'; }
}
export type SnapshotUpgrade = (raw: Record<string, unknown>) => Record<string, unknown>;
/**
 * Known snapshot migrations, keyed by the schemaVersion they upgrade from. None yet: 1.0.0 is the first
 * schema. Saves upgrade only along these steps; anything else is rejected, never guessed.
 */
export const SNAPSHOT_UPGRADES: Readonly<Record<string, SnapshotUpgrade>> = {};

/** Upgrades a stored snapshot through known steps (in memory only), then validates it strictly. */
export function guardSnapshot(roomId: string, raw: unknown, upgrades: Readonly<Record<string, SnapshotUpgrade>> = SNAPSHOT_UPGRADES): GameState {
  let value = raw as Record<string, unknown>;
  for (let steps = 0; typeof value.schemaVersion === 'string' && upgrades[value.schemaVersion] && steps < 100; steps++) {
    value = upgrades[value.schemaVersion]!(value);
  }
  try {
    return deserializeGame(JSON.stringify(value));
  } catch (e) {
    if (e instanceof SnapshotError) throw new IncompatibleSave(roomId, e.path);
    throw e;
  }
}
