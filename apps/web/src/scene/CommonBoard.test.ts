import { describe, expect, it } from 'vitest';
import type { BuildingType } from '@vibe-rico/game-engine';
import { BUILDING_ORDER, buildingMarket, shipSlots, tradingSlots } from './pieces.js';

describe('shared-area piece counts', () => {
  it('ships show every slot: empty, partly loaded and full', () => {
    expect(shipSlots({ capacity: 4, goodType: null, loadedCount: 0 })).toEqual([null, null, null, null]);
    expect(shipSlots({ capacity: 5, goodType: 'corn', loadedCount: 2 })).toEqual(['corn', 'corn', null, null, null]);
    expect(shipSlots({ capacity: 6, goodType: 'coffee', loadedCount: 6 })).toEqual(Array(6).fill('coffee'));
  });

  it('the Trading House always shows four slots in sale order', () => {
    expect(tradingSlots([])).toEqual([null, null, null, null]);
    expect(tradingSlots(['sugar', 'corn'])).toEqual(['sugar', 'corn', null, null]);
    expect(tradingSlots(['sugar', 'corn', 'fruit', 'coffee'])).toEqual(['sugar', 'corn', 'fruit', 'coffee']);
  });

  it('the building market lists all 23 types in catalog order, keeping sold-out types marked', () => {
    const stock = Object.fromEntries(BUILDING_ORDER.map(t => [t, 1])) as Record<BuildingType, number>;
    stock['city-hall'] = 0;
    const market = buildingMarket(stock);
    expect(market).toHaveLength(23);
    expect(market.map(m => m.type)).toEqual(BUILDING_ORDER);
    expect(market.find(m => m.type === 'city-hall')).toEqual({ type: 'city-hall', count: 0, exhausted: true });
    expect(market.filter(m => m.exhausted)).toHaveLength(1);
  });
});

import type { BuildingInstance, CountrysideTile } from '@vibe-rico/game-engine';
import { citySlots, fieldSlots } from './boardLayout.js';

describe('player board layout', () => {
  const tile = (i: number, kind: CountrysideTile['kind'] = 'corn'): CountrysideTile => ({ instanceId: `t${i}` as never, kind, occupied: i % 2 === 0 });
  const building = (i: number, buildingTypeId: BuildingInstance['buildingTypeId']): BuildingInstance => ({ instanceId: `b${i}` as never, buildingTypeId, occupiedSlots: 0 });

  it('always shows 12 Countryside spaces, filled in order, keyed by tile ID', () => {
    expect(fieldSlots([])).toHaveLength(12);
    expect(fieldSlots([]).every(s => s.tile === null)).toBe(true);
    const full = fieldSlots(Array.from({ length: 12 }, (_, i) => tile(i, i === 11 ? 'quarry' : 'corn')));
    expect(full.map(s => s.tile!.instanceId)).toEqual(Array.from({ length: 12 }, (_, i) => `t${i}`));
    expect(full[11]).toMatchObject({ col: 3, row: 2 });
  });

  it('lays out a full City with two-space buildings that never wrap across rows', () => {
    // 1 + 2 + 1 wraps the second large building; totals 12 spaces over 3 rows.
    const city = citySlots([
      building(0, 'small-market'), building(1, 'fortress'), building(2, 'hacienda'),
      building(3, 'city-hall'), building(4, 'customs-house'),
      building(5, 'residence'), building(6, 'fire-station'),
    ]);
    expect(city.map(c => [c.building.instanceId, c.row, c.col, c.span])).toEqual([
      ['b0', 0, 0, 1], ['b1', 0, 1, 2], ['b2', 0, 3, 1], ['b3', 1, 0, 2], ['b4', 1, 2, 2], ['b5', 2, 0, 2], ['b6', 2, 2, 2],
    ]);
    expect(city.find(c => c.building.buildingTypeId === 'large-coffee-roaster')).toBeUndefined();
    expect(citySlots([building(9, 'large-fruit-depot')])[0]).toMatchObject({ span: 1, workerSlots: 3 });
  });
});
