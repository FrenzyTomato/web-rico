import { validateRng, RngError } from '../rng/seeded.js';
import { createId } from './ids.js';
import type { EntityId, IdKind } from './ids.js';
import { RULESET } from './state.js';
import type { BuildingType, Cargo, EndTrigger, GameState, Good, ScoringBuilding } from './state.js';
import type { GamePhase } from './phase.js';

export const SNAPSHOT_SCHEMA_VERSION = '1.0.0';
export const SNAPSHOT_ENGINE_VERSION = '0.0.0';
export class SnapshotError extends Error {
  constructor(readonly code: 'INVALID_SNAPSHOT' | 'UNSUPPORTED_VERSION', readonly path: string) {
    super(`${code}: ${path}`);
    this.name = 'SnapshotError';
  }
}
type Decoder<T> = (value: unknown, path: string) => T;
function invalid(path: string): never { throw new SnapshotError('INVALID_SNAPSHOT', path); }
const text: Decoder<string> = (v, p) => typeof v === 'string' && v.trim().length > 0 ? v : invalid(p);
const integer: Decoder<number> = (v, p) => typeof v === 'number' && Number.isSafeInteger(v) ? v : invalid(p);
const count: Decoder<number> = (v, p) => { const n = integer(v, p); return n >= 0 ? n : invalid(p); };
const positive: Decoder<number> = (v, p) => { const n = count(v, p); return n > 0 ? n : invalid(p); };
function values<const T extends readonly (string | number | boolean | null)[]>(...allowed: T): Decoder<T[number]> {
  return (v, p) => allowed.some(x => x === v) ? v as T[number] : invalid(p);
}
function id<K extends IdKind>(kind: K): Decoder<EntityId<K>> { return (v, p) => createId(kind, text(v, p)); }
function array<T>(item: Decoder<T>): Decoder<T[]> {
  return (v, p) => {
    if (!Array.isArray(v)) return invalid(p);
    return Array.from(v, (x: unknown, i) => item(x, `${p}[${i}]`));
  };
}
function object<S extends Record<string, Decoder<unknown>>>(shape: S): Decoder<{ [K in keyof S]: ReturnType<S[K]> }> {
  return (v, p) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)
      || (Object.getPrototypeOf(v) !== Object.prototype && Object.getPrototypeOf(v) !== null)) return invalid(p);
    const input = v as Record<string, unknown>;
    for (const key of Object.keys(input)) if (!Object.hasOwn(shape, key)) invalid(`${p}.${key}`);
    const result: Record<string, unknown> = {};
    for (const [key, decode] of Object.entries(shape)) {
      if (!Object.hasOwn(input, key)) invalid(`${p}.${key}`);
      result[key] = decode(input[key], `${p}.${key}`);
    }
    return result as { [K in keyof S]: ReturnType<S[K]> };
  };
}
function union<T>(...choices: readonly Decoder<T>[]): Decoder<T> {
  return (v, p) => {
    for (const decode of choices) {
      try { return decode(v, p); }
      catch (error) { if (!(error instanceof SnapshotError)) throw error; }
    }
    return invalid(p);
  };
}
function nullable<T>(decode: Decoder<T>): Decoder<T | null> { return union<T | null>(values(null), decode); }
function record<K extends string, T>(keys: readonly K[], decode: Decoder<T>): Decoder<Record<K, T>> {
  return object(Object.fromEntries(keys.map(k => [k, decode])) as Record<K, Decoder<T>>) as Decoder<Record<K, T>>;
}
const goodNames = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'] as const satisfies readonly Good[];
const scoringNames = ['fire-station', 'residence', 'fortress', 'customs-house', 'city-hall'] as const satisfies readonly ScoringBuilding[];
const buildingNames = [
  'small-fruit-depot', 'small-sugar-mill', 'large-fruit-depot', 'large-sugar-mill',
  'large-tobacco-storage', 'large-coffee-roaster', 'small-market', 'hacienda', 'builders-yard',
  'small-warehouse', 'hospital', 'office', 'large-market', 'large-warehouse', 'factory', 'school',
  'harbor', 'wharf', ...scoringNames,
] as const satisfies readonly BuildingType[];
const good = values(...goodNames);
const role = values('planter', 'recruiter', 'builder', 'craftsman', 'trader', 'captain', 'adventurer');
const bool = values(true, false);
const goods = record(goodNames, count);
const cargo = union<Cargo>(object({ goodType: values(null), loadedCount: values(0) }), object({ goodType: good, loadedCount: positive }));
const estate = object({ instanceId: id('tile'), kind: good });
const countryside = object({ instanceId: id('tile'), kind: values(...goodNames, 'quarry'), occupied: bool });
const building = object({ instanceId: id('building'), buildingTypeId: values(...buildingNames), occupiedSlots: count });
// Cargo extensions are checked as a whole, then their common cargo shape is validated.
const personalShip: Decoder<GameState['players'][number]['personalShip']> = nullable((v, p) => {
  const ship = object({ goodType: nullable(good), loadedCount: count, usedThisPhase: bool })(v, p);
  return { ...cargo({ goodType: ship.goodType, loadedCount: ship.loadedCount }, p), usedThisPhase: ship.usedThisPhase };
});
const ship: Decoder<GameState['ships'][number]> = (v, p) => {
  const s = object({ instanceId: id('ship'), capacity: values(4, 5, 6, 7, 8), goodType: nullable(good), loadedCount: count })(v, p);
  return { ...s, ...cargo({ goodType: s.goodType, loadedCount: s.loadedCount }, p) };
};
const score = object({
  playerId: id('player'), earnedVp: count, baseBuildingVp: count, bonuses: record(scoringNames, count),
  totalVp: count, tieBreakCoinsAndGoods: count, rank: positive,
});
const turn = { actorId: id('player'), roleChooserId: id('player'), actorIndex: count };
const phase: Decoder<GamePhase> = union<GamePhase>(
  object({ kind: values('role-selection'), actorId: id('player') }),
  object({ kind: values('planter-before'), ...turn }),
  object({ kind: values('planter-choice'), ...turn, acquiredTileIds: array(id('tile')) }),
  object({ kind: values('planter-worker'), ...turn, acquiredTileIds: array(id('tile')) }),
  object({ kind: values('recruiter-advantage'), ...turn }),
  object({ kind: values('recruiter-distribution'), roleChooserId: id('player') }),
  object({ kind: values('recruiter-placement'), ...turn }),
  object({ kind: values('builder-choice'), ...turn }),
  object({ kind: values('craftsman-production'), ...turn, chooserProducedTypes: array(good) }),
  object({ kind: values('craftsman-bonus'), ...turn, chooserProducedTypes: array(good) }),
  object({ kind: values('trader-choice'), ...turn }),
  object({ kind: values('captain-loading'), ...turn, captainBonusUsed: bool, consecutiveNoLoads: count }),
  object({ kind: values('captain-retention'), ...turn }),
  object({ kind: values('adventurer'), ...turn }),
  object({ kind: values('phase-completion'), role, roleChooserId: id('player') }),
  object({ kind: values('round-completion') }),
  object({ kind: values('game-over'), scores: array(score) }),
);
const trigger: Decoder<EndTrigger> = union<EndTrigger>(
  object({ reason: values('worker-shortage'), role: values('recruiter'), triggeringRevision: count, completion: values('phase-completion') }),
  object({ reason: values('city-full'), role: values('builder'), playerId: id('player'), triggeringRevision: count, completion: values('phase-completion') }),
  object({ reason: values('vp-exhausted'), role: values('captain'), triggeringRevision: count, completion: values('phase-completion') }),
);
const decodeState: Decoder<GameState> = object({
  schemaVersion: values(SNAPSHOT_SCHEMA_VERSION), engineVersion: values(SNAPSHOT_ENGINE_VERSION),
  rulesetId: values(RULESET.id), rulesetVersion: values(RULESET.version), sourceHash: values(RULESET.sourceHash),
  gameId: id('game'), revision: count, seatOrder: array(id('player')),
  players: array(object({ playerId: id('player'), coins: count, earnedVp: count,
    countryside: array(countryside), buildings: array(building), idleWorkerCount: count, goods, personalShip })),
  governorPlayerId: id('player'), roundNumber: positive, roleSelectionIndex: count,
  roleCards: array(object({ instanceId: id('role-card'), kind: role, accumulatedCoins: count, selectedBy: nullable(id('player')) })),
  phase, supply: object({ goods, workerCount: count, workRegisterCount: count, quarryCount: count,
    buildingStock: record(buildingNames, count), vpRemaining: count, vpOverflow: count }),
  estateBag: array(estate), estateDiscard: array(estate), estateMarket: array(estate),
  ships: array(ship), tradingHouse: array(good),
  rng: (value, path) => {
    try { return validateRng(value); }
    catch (error) {
      if (error instanceof RngError) throw new SnapshotError(error.code === 'UNSUPPORTED_RNG' ? 'UNSUPPORTED_VERSION' : 'INVALID_SNAPSHOT', path);
      throw error;
    }
  }, endTriggers: array(trigger),
});
function unique(ids: readonly string[], path: string): void {
  if (new Set(ids).size !== ids.length) invalid(`${path}: duplicate ID`);
}
export function validateSnapshot(value: unknown): GameState {
  if (typeof value !== 'object' || value === null) return invalid('$');
  const input = value as Record<string, unknown>;
  for (const [key, expected] of Object.entries({ schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    engineVersion: SNAPSHOT_ENGINE_VERSION, rulesetId: RULESET.id, rulesetVersion: RULESET.version, sourceHash: RULESET.sourceHash })) {
    const actual = text(input[key], `$.${key}`);
    if (actual !== expected) throw new SnapshotError('UNSUPPORTED_VERSION', `$.${key}`);
  }
  const state = decodeState(value, '$');
  unique(state.seatOrder, '$.seatOrder');
  unique(state.players.map(p => p.playerId), '$.players');
  unique([
    ...state.estateBag, ...state.estateDiscard, ...state.estateMarket,
    ...state.players.flatMap(p => p.countryside), ...state.players.flatMap(p => p.buildings),
    ...state.roleCards, ...state.ships,
  ].map(entity => entity.instanceId), '$.components');
  return state;
}

/** Server-only snapshots; PR-008 adds game invariants before accepting restored play. */
export function deserializeGame(json: string): GameState {
  let value: unknown;
  try { value = JSON.parse(json); } catch { return invalid('$: invalid JSON'); }
  return validateSnapshot(value);
}
export function serializeGame(state: GameState): string { return JSON.stringify(validateSnapshot(state)); }
