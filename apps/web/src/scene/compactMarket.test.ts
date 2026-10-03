import { expect, it } from 'vitest';
import { BUILDINGS } from '@vibe-rico/game-engine';
import { BUILDING_ORDER, compactBuildingTiers } from './pieces.js';

it('packs every building once by discount, with its own price and room below for labels', () => {
  const tiers = compactBuildingTiers();
  const items = tiers.flatMap(t => t.items);
  expect(items.map(i => i.type).sort()).toEqual([...BUILDING_ORDER].sort());
  for (const tier of tiers) {
    expect(new Set(tier.items.map(i => i.x)).size).toBeLessThanOrEqual(2);
    for (const item of tier.items) {
      expect(BUILDINGS[item.type].quarryCap).toBe(tier.cap);
      expect(item.price).toBe(BUILDINGS[item.type].cost);
    }
    expect(new Set(tier.items.map(i => `${i.x},${i.z}`)).size).toBe(tier.items.length);
  }
  expect(tiers.at(-1)!.end + 2.3).toBeLessThan(26);
});
