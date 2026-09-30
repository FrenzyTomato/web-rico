/** Documented defaults (PROTOCOL.md "Room lifecycle and limits — PR-040"). */
export const LIMITS = {
  /** A room with no connected player for this long is removed; seats wait for reconnects until then. */
  emptyRoomTtlMs: 24 * 60 * 60 * 1000,
  /** How often the server runs empty-room cleanup. */
  sweepIntervalMs: 60 * 1000,
  /** Incoming Socket.IO events allowed per connection per window; more closes the connection. */
  eventsPerWindow: 20,
  windowMs: 1000,
} as const;

/** Fixed-window counter keyed by connection. */
export class RateLimiter {
  readonly #windows = new Map<string, { start: number; count: number }>();
  constructor(private readonly limit: number, private readonly windowMs: number) {}

  allow(key: string, now: number): boolean {
    const w = this.#windows.get(key);
    if (!w || now - w.start >= this.windowMs) { this.#windows.set(key, { start: now, count: 1 }); return true; }
    w.count++;
    return w.count <= this.limit;
  }
  forget(key: string): void { this.#windows.delete(key); }
}
