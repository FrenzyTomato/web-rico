/** xoshiro128** 1.1 / SplitMix64, Blackman & Vigna, public-domain reference:
 * https://prng.di.unimi.it/xoshiro128starstar.c
 * https://prng.di.unimi.it/splitmix64.c
 * Project version 1 freezes uint32 seed expansion and shuffle draw order too.
 */
export interface RngState {
  readonly algorithm: 'xoshiro128ss';
  readonly version: '1';
  readonly state: readonly [number, number, number, number];
}
export class RngError extends Error {
  constructor(readonly code: 'INVALID_RNG' | 'UNSUPPORTED_RNG') { super(code); this.name = 'RngError'; }
}
const RANGE = 0x100000000;
function uint32(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < RANGE;
}
function pack(a: number, b: number, c: number, d: number): RngState {
  return { algorithm: 'xoshiro128ss', version: '1', state: [a, b, c, d] };
}
export function validateRng(value: unknown): RngState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new RngError('INVALID_RNG');
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 3 || !Object.hasOwn(v, 'algorithm') || !Object.hasOwn(v, 'version') || !Object.hasOwn(v, 'state')) throw new RngError('INVALID_RNG');
  if (typeof v.algorithm !== 'string' || typeof v.version !== 'string') throw new RngError('INVALID_RNG');
  if (v.algorithm !== 'xoshiro128ss' || v.version !== '1') throw new RngError('UNSUPPORTED_RNG');
  if (!Array.isArray(v.state) || v.state.length !== 4) throw new RngError('INVALID_RNG');
  const [a, b, c, d]: unknown[] = v.state;
  if (!uint32(a) || !uint32(b) || !uint32(c) || !uint32(d) || (a === 0 && b === 0 && c === 0 && d === 0)) throw new RngError('INVALID_RNG');
  return pack(a, b, c, d);
}
/** Seed is an unsigned 32-bit integer, including zero. No time/global RNG input. */
export function seedRng(seed: number): RngState {
  if (!uint32(seed)) throw new RngError('INVALID_RNG');
  const mask = (1n << 64n) - 1n;
  let cursor = BigInt(seed);
  const split = (): bigint => {
    cursor = (cursor + 0x9e3779b97f4a7c15n) & mask;
    let z = cursor;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & mask;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & mask;
    return z ^ (z >> 31n);
  };
  const first = split(); const second = split();
  return pack(Number(first & 0xffffffffn), Number(first >> 32n), Number(second & 0xffffffffn), Number(second >> 32n));
}
function rotate(value: number, bits: number): number { return ((value << bits) | (value >>> (32 - bits))) >>> 0; }
export function nextUint32(input: RngState): { readonly value: number; readonly rng: RngState } {
  let [a, b, c, d] = validateRng(input).state;
  const value = Math.imul(rotate(Math.imul(b, 5), 7), 9) >>> 0;
  const t = b << 9;
  c ^= a; d ^= b; b ^= c; a ^= d; c ^= t; d = rotate(d, 11);
  return { value, rng: pack(a >>> 0, b >>> 0, c >>> 0, d) };
}
/** Uniform integer in [0, upperExclusive); reject the incomplete modulo bucket. */
export function randomInt(input: RngState, upperExclusive: number): { readonly value: number; readonly rng: RngState } {
  if (!Number.isInteger(upperExclusive) || upperExclusive < 1 || upperExclusive > RANGE) throw new RngError('INVALID_RNG');
  const limit = Math.floor(RANGE / upperExclusive) * upperExclusive;
  let rng = input;
  for (;;) {
    const step = nextUint32(rng); rng = step.rng;
    if (step.value < limit) return { value: step.value % upperExclusive, rng };
  }
}
/** Descending Fisher–Yates. Empty/singleton inputs consume no random draws. */
export function shuffle<T>(input: RngState, values: readonly T[]): { readonly items: readonly T[]; readonly rng: RngState } {
  let rng = validateRng(input);
  const items = [...values];
  for (let i = items.length - 1; i > 0; i--) {
    const step = randomInt(rng, i + 1); rng = step.rng;
    const tmp = items[i]!; items[i] = items[step.value]!; items[step.value] = tmp;
  }
  return { items, rng };
}
