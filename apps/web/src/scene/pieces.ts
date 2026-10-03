import { BUILDINGS } from '@vibe-rico/game-engine';
import type { BuildingType, CargoShip, Good } from '@vibe-rico/game-engine';

/** DESIGN.md palette for goods in the scene. */
export const GOOD_COLOR: Record<Good, string> = { corn: '#e6c34a', fruit: '#c9553f', sugar: '#f4f1ea', tobacco: '#8a5a36', coffee: '#3b2a20' };
export const QUARRY_COLOR = '#8d8a84';
export const SEAT_COLORS = ['#b5483a', '#d6a94a', '#3f6fa8', '#e8e2d4', '#5b8a4f'] as const;

/** One slot per crate of capacity; the first `loadedCount` hold the ship's good. */
export function shipSlots(ship: Pick<CargoShip, 'capacity' | 'goodType' | 'loadedCount'>): (Good | null)[] {
  return Array.from({ length: ship.capacity }, (_, i) => (i < ship.loadedCount ? ship.goodType : null));
}
/** The Trading House always shows its four slots, filled in sale order. */
export const tradingSlots = (house: readonly Good[]): (Good | null)[] => Array.from({ length: 4 }, (_, i) => house[i] ?? null);

/** Catalog order (RULES.md BUILDING-001–023); every type stays visible, sold-out ones marked exhausted. */
export const BUILDING_ORDER: readonly BuildingType[] = [
  'small-fruit-depot', 'small-sugar-mill', 'large-fruit-depot', 'large-sugar-mill', 'large-tobacco-storage', 'large-coffee-roaster',
  'small-market', 'hacienda', 'builders-yard', 'small-warehouse', 'hospital', 'office', 'large-market', 'large-warehouse',
  'factory', 'school', 'harbor', 'wharf', 'fire-station', 'residence', 'fortress', 'customs-house', 'city-hall',
];
export function buildingMarket(stock: Readonly<Record<BuildingType, number>>) {
  return [...BUILDING_ORDER].sort((a, b) => BUILDINGS[a].cost - BUILDINGS[b].cost).map(type => ({ type, count: stock[type], exhausted: stock[type] === 0 }));
}

/** Shared by the market meshes and mobile tier camera, so their positions cannot drift. */
export function buildingTiers() {
  let nextX = 0;
  return [1, 2, 3, 4].map(cap => {
    const start = nextX;
    const types = BUILDING_ORDER.filter(type => BUILDINGS[type].quarryCap === cap);
    const prices = [...new Set(types.map(type => BUILDINGS[type].cost))].sort((a, b) => a - b).map(price => {
      const buildings = types.filter(type => BUILDINGS[type].cost === price);
      const columns = Math.ceil(buildings.length / 3);
      const x = nextX;
      nextX += columns * 2.55 + 0.22;
      return { price, buildings, columns, x };
    });
    const end = nextX - 2.77;
    return { cap, start, end, prices };
  });
}

export const BUILDING_MARKET_ORIGIN = { x: -1.5, z: 0.4 } as const;

/** Two-column discount groups: prices belong to pieces, not columns. */
export function compactBuildingTiers() {
  return buildingTiers().map((tier, index) => {
    const types = tier.prices.flatMap(group => group.buildings);
    const start = index * 6.4;
    return {
      cap: tier.cap, start, end: start + 2.8,
      depth: (Math.ceil(types.length / 2) - 1) * 2.9 + 4,
      items: types.map((type, i) => ({ type, price: BUILDINGS[type].cost, x: start + i % 2 * 2.8, z: Math.floor(i / 2) * 2.9 })),
    };
  });
}
