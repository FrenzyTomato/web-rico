import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { effectFor } from './transitions.js';

export const PULSE_MS = 600;
/** More waiting effects than this means the viewer is lagging: drop the oldest and align to now. */
export const MAX_BACKLOG = 6;

/**
 * Short event-driven highlights (PR-053). Broadcasts are accepted once each, in revision order; a
 * revision gap (missed events, reconnect snapshot) or `skip` drops pending effects. The queue never
 * holds game state, so whatever it shows, the scene still renders the latest snapshot.
 */
export function createEventQueue(durationMs = PULSE_MS, maxBacklog = MAX_BACKLOG) {
  let lastRevision: number | null = null;
  let pending: string[] = [];
  let current: { target: string; until: number } | null = null;
  return {
    accept(broadcast: Pick<PlayerBroadcast, 'revision' | 'events'>) {
      if (lastRevision !== null && broadcast.revision <= lastRevision) return; // duplicate or old
      if (lastRevision !== null && broadcast.revision !== lastRevision + 1) { pending = []; current = null; } // gap
      lastRevision = broadcast.revision;
      // Events of one broadcast share its revision; each (revision, index) is therefore seen at most once.
      pending.push(...broadcast.events.map(effectFor).filter((t): t is string => t !== null));
      if (pending.length > maxBacklog) pending = pending.slice(-maxBacklog);
    },
    /** The target to highlight at `now`, advancing through pending effects. */
    active(now: number): string | null {
      if (current && now < current.until) return current.target;
      const next = pending.shift();
      current = next && durationMs > 0 ? { target: next, until: now + durationMs } : null;
      return current?.target ?? null;
    },
    busy: () => current !== null || pending.length > 0,
    skip() { pending = []; current = null; },
  };
}
export type EventQueue = ReturnType<typeof createEventQueue>;
