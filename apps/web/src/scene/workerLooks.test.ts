import { describe, expect, it } from 'vitest';
import { poolLooks, slotLook, workerModel } from './workerLooks.js';

describe('worker looks', () => {
  it('varies across slots and is fixed for each slot', () => {
    const looks = ['tile-1', 'tile-2', 'tile-3', 'building-1', 'building-2'].map(id => slotLook(id, 0));
    expect(new Set(looks).size).toBeGreaterThan(1);
    expect(slotLook('tile-1', 0)).toBe(looks[0]);
    expect(workerModel(slotLook('tile-1', 0))).toMatch(/^Worker 0[1-5]$/);
  });
  it('gives a pool different consecutive portraits', () => {
    expect(new Set(poolLooks('p1', 3)).size).toBe(3);
  });
});
