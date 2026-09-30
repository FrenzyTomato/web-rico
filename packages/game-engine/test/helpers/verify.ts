import { expect } from 'vitest';
import type { BuildingType, FinalScoreBreakdown, GameState, Good, PlayerState } from '../../src/index.js';

// Independent literals from S3 pp.3–8,18–22 and PROJECT-003 (docs/TEST_SCENARIOS.md SET-01/03, B-01…B-23),
// deliberately not imported from the engine catalog.
const GOODS: Record<Good, number> = { corn: 10, fruit: 11, sugar: 11, tobacco: 9, coffee: 9 };
const WORKERS: Record<number, number> = { 3: 58, 4: 79, 5: 100 };
const VP: Record<number, number> = { 3: 75, 4: 100, 5: 126 };
const BASE_VP: Record<BuildingType, number> = {
  'small-fruit-depot': 1, 'small-sugar-mill': 1, 'large-fruit-depot': 2, 'large-sugar-mill': 2,
  'large-tobacco-storage': 3, 'large-coffee-roaster': 3, 'small-market': 1, hacienda: 1, 'builders-yard': 1,
  'small-warehouse': 1, hospital: 2, office: 2, 'large-market': 2, 'large-warehouse': 2, factory: 3,
  school: 3, harbor: 3, wharf: 3, 'fire-station': 4, residence: 4, fortress: 4, 'customs-house': 4, 'city-hall': 4,
};
const SMALL_PRODUCTION: BuildingType[] = ['small-fruit-depot', 'small-sugar-mill'];
const LARGE_PRODUCTION: BuildingType[] = ['large-fruit-depot', 'large-sugar-mill', 'large-tobacco-storage', 'large-coffee-roaster'];
const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const workers = (p: PlayerState) => p.idleWorkerCount + p.countryside.filter(t => t.occupied).length + sum(p.buildings.map(b => b.occupiedSlots));

/** Finite-component and score ledgers (INVARIANT-001/002/003), counted location by location. */
export function expectLedgers(s: GameState): void {
  const n = s.seatOrder.length;
  for (const good of Object.keys(GOODS) as Good[]) {
    expect(s.supply.goods[good] + sum(s.players.map(p => p.goods[good] + (p.personalShip?.goodType === good ? p.personalShip.loadedCount : 0)))
      + sum(s.ships.map(x => x.goodType === good ? x.loadedCount : 0)) + s.tradingHouse.filter(g => g === good).length, good).toBe(GOODS[good]);
  }
  const tiles = [...s.estateBag, ...s.estateDiscard, ...s.estateMarket, ...s.players.flatMap(p => p.countryside)];
  expect(tiles.filter(t => t.kind !== 'quarry')).toHaveLength(50);
  expect(tiles.filter(t => t.kind === 'quarry').length + s.supply.quarryCount).toBe(8);
  expect(sum(Object.values(s.supply.buildingStock)) + sum(s.players.map(p => p.buildings.length))).toBe(49);
  expect(s.supply.workerCount + s.supply.workRegisterCount + sum(s.players.map(workers))).toBe(WORKERS[n]);
  expect(sum(s.players.map(p => p.earnedVp)) + s.supply.vpRemaining).toBe(VP[n]! + s.supply.vpOverflow);
  for (const p of s.players) expect(p.coins).toBeGreaterThanOrEqual(0);
}

/** SCORE-001/002 recomputed from literal building VP and bonus rules; seat order, competition ranks. */
export function independentScores(s: GameState): FinalScoreBreakdown[] {
  const scores = s.seatOrder.map(playerId => {
    const p = s.players.find(x => x.playerId === playerId)!;
    const active = (t: BuildingType) => p.buildings.some(b => b.buildingTypeId === t && b.occupiedSlots > 0);
    const types = p.buildings.map(b => b.buildingTypeId);
    const tiles = p.countryside.length;
    const bonuses = {
      'fire-station': active('fire-station') ? types.filter(t => SMALL_PRODUCTION.includes(t)).length + 2 * types.filter(t => LARGE_PRODUCTION.includes(t)).length : 0,
      residence: active('residence') ? (tiles <= 9 ? 4 : tiles - 5) : 0,
      fortress: active('fortress') ? Math.floor(workers(p) / 3) : 0,
      'customs-house': active('customs-house') ? Math.floor(p.earnedVp / 4) : 0,
      'city-hall': active('city-hall') ? types.filter(t => !SMALL_PRODUCTION.includes(t) && !LARGE_PRODUCTION.includes(t)).length : 0,
    };
    const baseBuildingVp = sum(types.map(t => BASE_VP[t]));
    return { playerId, earnedVp: p.earnedVp, baseBuildingVp, bonuses, totalVp: p.earnedVp + baseBuildingVp + sum(Object.values(bonuses)),
      tieBreakCoinsAndGoods: p.coins + sum(Object.values(p.goods)), rank: 0 };
  });
  return scores.map(x => ({ ...x, rank: 1 + scores.filter(y => y.totalVp > x.totalVp
    || (y.totalVp === x.totalVp && y.tieBreakCoinsAndGoods > x.tieBreakCoinsAndGoods)).length }));
}
