import { describe, expect, it } from 'vitest';
import { createId, serializeGame, deserializeGame, SnapshotError, seedRng, nextUint32 } from '../src/index.js';
import type { PlayerId, ShipId, LegalOptionsByPhase } from '../src/index.js';

const player: PlayerId = createId('player', 'a');
// @ts-expect-error Entity kinds cannot be interchanged.
const ship: ShipId = player;
// @ts-expect-error Raw strings must pass through the ID boundary.
const raw: PlayerId = 'a';
// @ts-expect-error A building allocation slot cannot contain a countryside tile ID.
const badSlot: LegalOptionsByPhase['recruiter-placement']['slots'][number] = { kind: 'building', instanceId: createId('tile', 'tile-1'), capacity: 1 };

// A structurally complete snapshot, not a claim of legal setup (PR-010).
function snapshot() {
  const zeroGoods = { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
  const stock = Object.fromEntries([
    'small-fruit-depot', 'small-sugar-mill', 'large-fruit-depot', 'large-sugar-mill',
    'large-tobacco-storage', 'large-coffee-roaster', 'small-market', 'hacienda',
    'builders-yard', 'small-warehouse', 'hospital', 'office', 'large-market',
    'large-warehouse', 'factory', 'school', 'harbor', 'wharf',
    'fire-station', 'residence', 'fortress', 'customs-house', 'city-hall',
  ].map(key => [key, 0]));
  return {
    schemaVersion: '1.0.0', engineVersion: '0.0.0',
    rulesetId: 'puerto-rico-1897-special-edition-base-en', rulesetVersion: '1.0.0',
    sourceHash: '9240acbb1121a1e43019d9ae228603748c4447e36caf2be0c65c2ca2d8373c91',
    gameId: 'game-1', revision: 7, seatOrder: ['a', 'b', 'c'],
    players: ['a', 'b', 'c'].map(playerId => ({
      playerId, coins: 2, earnedVp: 0, countryside: [], buildings: [], idleWorkerCount: 0,
      goods: { ...zeroGoods }, personalShip: null,
    })),
    governorPlayerId: 'a', roundNumber: 1, roleSelectionIndex: 0,
    roleCards: [{ instanceId: 'role-1', kind: 'planter', accumulatedCoins: 2, selectedBy: null }],
    phase: { kind: 'role-selection', actorId: 'a' },
    supply: { goods: zeroGoods, workerCount: 55, workRegisterCount: 3, quarryCount: 8,
      buildingStock: stock, vpRemaining: 75, vpOverflow: 0 },
    estateBag: [{ instanceId: 'tile-1', kind: 'coffee' }], estateDiscard: [], estateMarket: [] as { instanceId: string; kind: string }[],
    ships: [{ instanceId: 'ship-1', capacity: 4, goodType: null, loadedCount: 0 }],
    tradingHouse: [], rng: { algorithm: 'xoshiro128ss', version: '1', state: [1, 2, 3, 4] }, endTriggers: [],
  };
}

function load(value: unknown) { return deserializeGame(JSON.stringify(value)); }

describe('IDs and snapshots', () => {
  it('preserves ID text and rejects blank IDs', () => {
    expect(player).toBe('a');
    expect(() => createId('player', '')).toThrow();
    expect(() => createId('tile', '  ')).toThrow();
  });
  it('round trips every field and returns a detached snapshot', () => {
    const original = snapshot();
    const restored = load(original);
    expect(restored).toEqual(original);
    expect(deserializeGame(serializeGame(restored))).toEqual(original);
    expect(restored.players).not.toBe(original.players);
  });
  it.each(['schemaVersion', 'engineVersion', 'rulesetId', 'rulesetVersion', 'sourceHash'] as const)(
    'rejects unsupported %s', field => {
      const value = snapshot(); value[field] = 'future';
      try { load(value); expect.unreachable(); }
      catch (error) { expect(error).toBeInstanceOf(SnapshotError); expect((error as SnapshotError).code).toBe('UNSUPPORTED_VERSION'); }
    },
  );
  it.each([
    (s: Record<string, unknown>) => { delete s.supply; },
    (s: Record<string, unknown>) => { s.revision = -1; },
    (s: Record<string, unknown>) => { s.revision = 1.5; },
    (s: Record<string, unknown>) => { s.revision = Number.MAX_SAFE_INTEGER + 1; },
    (s: Record<string, unknown>) => { s.gameId = ''; },
    (s: Record<string, unknown>) => { s.phase = { kind: 'captain-loading', actorId: 'a' }; },
    (s: Record<string, unknown>) => { s.phase = { kind: 'unknown' }; },
    (s: Record<string, unknown>) => { s.phase = { kind: 'round-completion', actorId: 'a' }; },
    (s: Record<string, unknown>) => { s.tradingHouse = ['indigo']; },
    (s: Record<string, unknown>) => { s.unexpected = true; },
  ])('rejects damaged or extra fields (%#)', mutate => {
    const value = snapshot(); mutate(value); expect(() => load(value)).toThrow(SnapshotError);
  });
  it('rejects duplicate physical IDs across locations and duplicate player IDs', () => {
    const value = snapshot();
    value.estateMarket = [...value.estateBag];
    expect(() => load(value)).toThrow(/duplicate/i);
    const players = snapshot(); players.players[1] = players.players[0]!;
    expect(() => load(players)).toThrow(/duplicate/i);
  });

  it.each([
    { kind: 'role-selection', actorId: 'a' },
    { kind: 'planter-before', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'planter-choice', actorId: 'a', roleChooserId: 'a', actorIndex: 0, acquiredTileIds: ['tile-1'] },
    { kind: 'planter-worker', actorId: 'a', roleChooserId: 'a', actorIndex: 0, acquiredTileIds: ['tile-1'] },
    { kind: 'recruiter-advantage', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'recruiter-distribution', roleChooserId: 'a' },
    { kind: 'recruiter-placement', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'builder-choice', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'craftsman-production', actorId: 'a', roleChooserId: 'a', actorIndex: 0, chooserProducedTypes: ['corn'] },
    { kind: 'craftsman-bonus', actorId: 'a', roleChooserId: 'a', actorIndex: 0, chooserProducedTypes: ['corn'] },
    { kind: 'trader-choice', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'captain-loading', actorId: 'a', roleChooserId: 'a', actorIndex: 0, captainBonusUsed: true, consecutiveNoLoads: 2 },
    { kind: 'captain-retention', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'adventurer', actorId: 'a', roleChooserId: 'a', actorIndex: 0 },
    { kind: 'phase-completion', role: 'captain', roleChooserId: 'a' },
    { kind: 'round-completion' },
    { kind: 'game-over', scores: [{ playerId: 'a', earnedVp: 7, baseBuildingVp: 4,
      bonuses: { 'fire-station': 0, residence: 0, fortress: 0, 'customs-house': 1, 'city-hall': 0 },
      totalVp: 12, tieBreakCoinsAndGoods: 2, rank: 1 }] },
  ])('round trips phase $kind', phase => {
    const value = { ...snapshot(), phase };
    expect(deserializeGame(serializeGame(load(value)))).toEqual(value);
  });
  it('preserves nested placements, Personal Ship cargo and end triggers', () => {
    const base = snapshot();
    const value = { ...base, players: base.players.map((p, i) => i === 0 ? { ...p,
      countryside: [{ instanceId: 'quarry-1', kind: 'quarry', occupied: true }],
      buildings: [{ instanceId: 'building-1', buildingTypeId: 'wharf', occupiedSlots: 1 }],
      personalShip: { goodType: 'coffee', loadedCount: 3, usedThisPhase: true },
    } : p), ships: [{ instanceId: 'ship-1', capacity: 4, goodType: 'corn', loadedCount: 2 }],
    endTriggers: [
      { reason: 'worker-shortage', role: 'recruiter', triggeringRevision: 5, completion: 'phase-completion' },
      { reason: 'city-full', role: 'builder', playerId: 'a', triggeringRevision: 6, completion: 'phase-completion' },
      { reason: 'vp-exhausted', role: 'captain', triggeringRevision: 7, completion: 'phase-completion' },
    ] };
    // Synthetic storage fixture; legal combinations of triggers belong to PR-008/032.
    expect(deserializeGame(serializeGame(load(value)))).toEqual(value);
  });
  it.each([
    { goodType: null, loadedCount: 1 }, { goodType: 'corn', loadedCount: 0 },
    { goodType: 'corn', loadedCount: -1 }, { goodType: 'indigo', loadedCount: 1 },
  ])('rejects inconsistent cargo %#', cargo => {
    expect(() => load({ ...snapshot(), ships: [{ instanceId: 'ship-1', capacity: 4, ...cargo }] })).toThrow(SnapshotError);
  });
  it('rejects missing catalog counts, duplicate role/ship IDs, and damaged nested types', () => {
    const stock = snapshot(); delete stock.supply.buildingStock.wharf;
    expect(() => load(stock)).toThrow(SnapshotError);
    const duplicate = snapshot(); duplicate.ships[0]!.instanceId = 'role-1';
    expect(() => load(duplicate)).toThrow(/duplicate/i);
    const value = snapshot();
    expect(() => load({ ...value, players: [{ ...value.players[0], earnedVp: '7' }] })).toThrow(SnapshotError);
    expect(() => load({ ...value, rng: { algorithm: 'x', version: '1', state: [null] } })).toThrow(SnapshotError);
  });


  it('continues RNG exactly through the full snapshot boundary', () => {
    const progressed = nextUint32(seedRng(1)).rng;
    const before = load({ ...snapshot(), rng: progressed });
    const after = deserializeGame(serializeGame(before));
    expect(nextUint32(after.rng)).toEqual(nextUint32(before.rng));
    expect(nextUint32(after.rng).value).toBe(1423115009);
  });
  it.each([
    { algorithm: 'future', version: '1', state: [1,2,3,4] },
    { algorithm: 'xoshiro128ss', version: '2', state: [1,2,3,4] },
  ])('rejects incompatible RNG metadata at snapshot load', rng => {
    try { load({ ...snapshot(), rng }); expect.unreachable(); }
    catch (error) { expect(error).toBeInstanceOf(SnapshotError); expect((error as SnapshotError).code).toBe('UNSUPPORTED_VERSION'); }
  });
  it('rejects all-zero and truncated RNG state at snapshot load', () => {
    for (const state of [[0,0,0,0], [1,2,3]]) {
      expect(() => load({ ...snapshot(), rng: { algorithm: 'xoshiro128ss', version: '1', state } })).toThrow(SnapshotError);
    }
  });

  it('rejects invalid JSON and validates before writing', () => {
    expect(() => deserializeGame('{')).toThrow(SnapshotError);
    const state = load(snapshot());
    expect(() => serializeGame({ ...state, revision: Infinity })).toThrow(SnapshotError);
  });
});
