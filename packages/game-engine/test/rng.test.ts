import { expect, it } from 'vitest';
import { seedRng, nextUint32, randomInt, shuffle, validateRng } from '../src/index.js';
// Literal vectors computed independently with Python integer arithmetic from the
// authors' xoshiro128** 1.1 and SplitMix64 reference C; seed expansion is low/high
// words of two SplitMix64 outputs. Not computed by the production code in tests.
const vectors = [
  { seed: 0, initial: [2065550767,3793791033,2713282036,1853398634],
    values: [3737715805,2584255861,2876756834,3286328325,1553311962],
    end: [2543168483,2832276214,3654654659,2708758391], shuffled: ['e','d','a','c','f','b'] },
  { seed: 1, initial: [2298633409,2433363436,1703865447,3203108257],
    values: [1695105466,1423115009,634581793,1068227753,716759206],
    end: [492990829,4183846013,3295835456,3621199782], shuffled: ['d','a','c','b','f','e'] },
  { seed: 4294967295, initial: [2951840192,1940994978,323015604,1629504261],
    values: [331202089,2303545133,2732085799,1755962312,20464611],
    end: [955543441,4160079607,767029492,1628743853], shuffled: ['a','f','c','e','d','b'] },
];
it.each(vectors)('matches independent seed/next/shuffle vectors for $seed', v => {
  let rng = seedRng(v.seed);
  expect(rng.state).toEqual(v.initial);
  const results: number[] = [];
  for (let i = 0; i < 5; i++) { const step = nextUint32(rng); results.push(step.value); rng = step.rng; }
  expect(results).toEqual(v.values); expect(rng.state).toEqual(v.end);
  expect(shuffle(seedRng(v.seed), ['a','b','c','d','e','f']).items).toEqual(v.shuffled);
});
it('resumes the exact sequence from JSON without mutating its input', () => {
  const original = seedRng(1); Object.freeze(original.state); Object.freeze(original);
  const first = nextUint32(original);
  const recovered = validateRng(JSON.parse(JSON.stringify(first.rng)));
  expect(nextUint32(recovered)).toEqual(nextUint32(first.rng));
  expect(original.state).toEqual(vectors[1]!.initial);
});
it('shuffles a copy and preserves identity and repeated elements', () => {
  const item = { id: 1 }; const input = Object.freeze([item, item, { id: 2 }, item]);
  const result = shuffle(seedRng(9), input);
  expect(result.items).not.toBe(input);
  expect(result.items.filter(x => x === item)).toHaveLength(3);
  expect(result.items.find(x => x.id === 2)).toBe(input[2]);
  for (const small of [[], ['only']]) {
    const rng = seedRng(0); expect(shuffle(rng, small)).toEqual({ items: small, rng });
  }
});
it.each([-1, 1.5, NaN, Infinity, 4294967296])('rejects invalid seed %s', seed => {
  expect(() => seedRng(seed)).toThrow();
});
it.each([0, -1, 1.5, NaN, Infinity, 4294967297])('rejects invalid bound %s', bound => {
  expect(() => randomInt(seedRng(0), bound)).toThrow();
});
it('supports bounds 1 and 2^32 without signed overflow', () => {
  expect(randomInt(seedRng(0), 1).value).toBe(0);
  expect(randomInt(seedRng(0), 4294967296).value).toBe(3737715805);
});
it.each([
  { algorithm: 'other', version: '1', state: [1,2,3,4] },
  { algorithm: 'xoshiro128ss', version: '2', state: [1,2,3,4] },
  { algorithm: 'xoshiro128ss', version: '1', state: [0,0,0,0] },
  { algorithm: 'xoshiro128ss', version: '1', state: [1,2,3] },
  { algorithm: 'xoshiro128ss', version: '1', state: [1,2,3,-1] },
  { algorithm: 'xoshiro128ss', version: '1', state: [1,2,3,4294967296] },
])('rejects invalid saved RNG %#', value => { expect(() => validateRng(value)).toThrow(); });
it('rejects incomplete modulo buckets and preserves the state after all retries', () => {
  const rng = validateRng({ algorithm: 'xoshiro128ss', version: '1', state: [1,2199679431,2,3] });
  // Independent vector: three rejected draws 4294967295/4294950015/4294651262.
  expect(randomInt(rng, 2147483649)).toEqual({ value: 33550277,
    rng: { algorithm: 'xoshiro128ss', version: '1', state: [2061148560,3057435421,234267840,3477371288] } });
});
