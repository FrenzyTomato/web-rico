import { applyCommand } from '../applyCommand.js';
import { assertGameState, InvariantError } from '../invariants/assertGameState.js';
import type { GameCommand } from '../model/commands.js';
import type { GameEvent, RuleError } from '../model/events.js';
import { deserializeGame, serializeGame, SnapshotError, SNAPSHOT_ENGINE_VERSION, validateSnapshot } from '../model/serialization.js';
import { RULESET } from '../model/state.js';
import type { GameState } from '../model/state.js';

export const REPLAY_FORMAT_VERSION = '1';
/** Server-only replay: initial snapshot plus accepted commands, including declined effects. */
export interface ReplayRecord {
  readonly formatVersion: typeof REPLAY_FORMAT_VERSION;
  readonly engineVersion: string;
  readonly rulesetId: string;
  readonly rulesetVersion: string;
  readonly sourceHash: string;
  /** Setup seed when the history starts at createGame; the snapshot's rng state is authoritative. */
  readonly seed: number | null;
  readonly initialState: GameState;
  readonly commands: readonly GameCommand[];
}
export type ReplayFailure =
  | { readonly kind: 'invalid-record' | 'incompatible-version'; readonly path: string }
  | { readonly kind: 'invalid-snapshot'; readonly path: string; readonly detail?: string }
  | { readonly kind: 'rejected-command'; readonly index: number; readonly command: unknown; readonly error: RuleError };
export type ReplayResult =
  | { readonly ok: true; readonly initialState: GameState; readonly state: GameState; readonly events: readonly (readonly GameEvent[])[] }
  | { readonly ok: false; readonly failure: ReplayFailure };

const VERSIONS = {
  formatVersion: REPLAY_FORMAT_VERSION, engineVersion: SNAPSHOT_ENGINE_VERSION,
  rulesetId: RULESET.id, rulesetVersion: RULESET.version, sourceHash: RULESET.sourceHash,
} as const;
const KEYS = [...Object.keys(VERSIONS), 'seed', 'initialState', 'commands'];

/** Detached copy; commands are stored as submitted and revalidated only by replay. */
export function createReplay(initialState: GameState, commands: readonly GameCommand[], seed: number | null): ReplayRecord {
  return { ...VERSIONS, seed, initialState: deserializeGame(serializeGame(initialState)),
    commands: JSON.parse(JSON.stringify(commands)) as GameCommand[] };
}
export function serializeReplay(record: ReplayRecord): string {
  return JSON.stringify(Object.fromEntries(KEYS.map(key => [key, record[key as keyof ReplayRecord]])));
}

const fail = (failure: ReplayFailure): ReplayResult => ({ ok: false, failure });
/** Validates versions and the initial snapshot, then reapplies each command in order. */
export function replay(record: unknown): ReplayResult {
  if (typeof record !== 'object' || record === null || Array.isArray(record)) return fail({ kind: 'invalid-record', path: '$' });
  const input = record as Record<string, unknown>;
  for (const [key, expected] of Object.entries(VERSIONS)) {
    if (typeof input[key] !== 'string') return fail({ kind: 'invalid-record', path: `$.${key}` });
    if (input[key] !== expected) return fail({ kind: 'incompatible-version', path: `$.${key}` });
  }
  for (const key of Object.keys(input)) if (!KEYS.includes(key)) return fail({ kind: 'invalid-record', path: `$.${key}` });
  const seed = input.seed;
  if (seed !== null && !(Number.isInteger(seed) && (seed as number) >= 0 && (seed as number) <= 0xffffffff)) {
    return fail({ kind: 'invalid-record', path: '$.seed' });
  }
  if (!Array.isArray(input.commands)) return fail({ kind: 'invalid-record', path: '$.commands' });
  let initialState: GameState;
  try {
    initialState = validateSnapshot(input.initialState);
    assertGameState(initialState);
  } catch (error) {
    if (error instanceof SnapshotError) {
      const path = `$.initialState${error.path.slice(1)}`;
      return fail(error.code === 'UNSUPPORTED_VERSION' ? { kind: 'incompatible-version', path } : { kind: 'invalid-snapshot', path });
    }
    if (error instanceof InvariantError) return fail({ kind: 'invalid-snapshot', path: '$.initialState', detail: error.message });
    throw error;
  }
  let state = initialState;
  const events: (readonly GameEvent[])[] = [];
  for (const [index, command] of Array.from(input.commands as unknown[]).entries()) {
    // applyCommand defends against arbitrary JSON values and never mutates its input.
    const result = applyCommand(state, command as GameCommand);
    if (!result.ok) return fail({ kind: 'rejected-command', index, command, error: result.error });
    state = result.state;
    events.push(result.events);
  }
  return { ok: true, initialState, state, events };
}
