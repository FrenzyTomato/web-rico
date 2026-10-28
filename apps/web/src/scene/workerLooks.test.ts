import { describe, expect, it } from 'vitest';
import { poolLooks, slotLook, workerModel } from './workerLooks.js';

describe('worker looks', () => {
  it('varies across slots and is fixed for each slot', () => {
    const looks = ['tile-1', 'tile-2', 'tile-3', 'building-1', 'building-2'].map(id => slotLook(id, 0));
    expect(new Set(looks).size).toBeGreaterThan(1);
    expect(slotLook('tile-1', 0)).toBe(looks[0]);
    expect(workerModel(slotLook('tile-1', 0))).toMatch(/^Worker 0[1-5]$/);
  });
  it('picks pool portraits at random, kept for that pool and extended when workers arrive', () => {
    const first = poolLooks('p1:1', 2);
    expect(first.every(l => l >= 0 && l < 5)).toBe(true);
    expect(poolLooks('p1:1', 2)).toEqual(first);
    expect(poolLooks('p1:1', 4).slice(0, 2)).toEqual(first);
    // Across many rounds every model turns up.
    expect(new Set(Array.from({ length: 40 }, (_, r) => poolLooks(`p1:${r + 2}`, 1)[0])).size).toBe(5);
  });
});
