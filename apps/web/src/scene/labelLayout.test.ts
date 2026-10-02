import { describe, expect, it } from 'vitest';
import { labelWorldSize } from './labelLayout.js';

describe('readable label layout', () => {
  it('uses proportional world dimensions and respects the available column width', () => {
    const normal = labelWorldSize(0.68, 300, 104);
    const double = labelWorldSize(1.36, 300, 104);
    expect(double[0]).toBeCloseTo(normal[0] * 2);
    expect(double[1]).toBeCloseTo(normal[1] * 2);
    const constrained = labelWorldSize(0.68, 600, 184, 1.4);
    expect(constrained[0]).toBeCloseTo(1.4);
    expect(constrained[0] / constrained[1]).toBeCloseTo(600 / 184);
  });
});
