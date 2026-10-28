/** Worker portraits: five models. Workers are counts in the game, so each look is tied to where a worker stands. */
const LOOKS = 5;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const workerModel = (look: number) => `Worker ${String(look % LOOKS + 1).padStart(2, '0')}`;
/** The i-th worker in a plantation or building: fixed per slot, so staffed islands show a mix of workers. */
export const slotLook = (owner: string, i: number) => (hash(owner) + i) % LOOKS;
/**
 * Idle workers' portraits, picked at random. `key` names the pool (a player and round): within it the picks are
 * remembered, so portraits don't change on re-render and newly arrived workers add picks after the existing ones.
 */
const pools = new Map<string, number[]>();
export function poolLooks(key: string, count: number): number[] {
  const picks = pools.get(key) ?? [];
  while (picks.length < count) picks.push(Math.floor(Math.random() * LOOKS));
  pools.set(key, picks);
  return picks.slice(0, count);
}
export const poolKey = (playerId: string, round: number) => `${playerId}:${round}`;

/**
 * Looks of workers this client moved, by slot: a worker keeps the portrait it was picked with, during the draft
 * and after it is confirmed. Kept for the session; other seats and a reload fall back to `slotLook`.
 */
const placed = new Map<string, readonly number[]>();
export const lookAt = (owner: string, i: number) => placed.get(owner)?.[i] ?? slotLook(owner, i);
/** The looks of the first `count` workers in a slot. */
export const slotLooks = (owner: string, count: number) => Array.from({ length: count }, (_, i) => lookAt(owner, i));
export const placeLooks = (owner: string, looks: readonly number[]) => { placed.set(owner, looks); };
