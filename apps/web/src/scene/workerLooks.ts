/** Worker portraits: five models. Workers are counts in the game, so each look is tied to where a worker stands. */
const LOOKS = 5;
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const workerModel = (look: number) => `Worker ${String(look % LOOKS + 1).padStart(2, '0')}`;
/** The i-th worker in a plantation or building: fixed per slot, so staffed islands show a mix of workers. */
export const slotLook = (owner: string, i: number) => (hash(owner) + i) % LOOKS;
/** Idle workers in a player's pool before any are moved this turn. */
export const poolLooks = (playerId: string, count: number) => Array.from({ length: count }, (_, i) => (hash(playerId) + i) % LOOKS);

/**
 * Looks of workers this client moved, by slot: a worker keeps the portrait it was picked with, during the draft
 * and after it is confirmed. Kept for the session; other seats and a reload fall back to `slotLook`.
 */
const placed = new Map<string, readonly number[]>();
export const lookAt = (owner: string, i: number) => placed.get(owner)?.[i] ?? slotLook(owner, i);
/** The looks of the first `count` workers in a slot. */
export const slotLooks = (owner: string, count: number) => Array.from({ length: count }, (_, i) => lookAt(owner, i));
export const placeLooks = (owner: string, looks: readonly number[]) => { placed.set(owner, looks); };
