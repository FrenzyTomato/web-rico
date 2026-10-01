import type { Room, RoomStore } from '../rooms/store.js';

export type CommitOutcome = 'ok' | 'stale' | 'unavailable';
/**
 * PROTOCOL.md step 6: the new snapshot, the accepted command and its events go to the store in one
 * transactional write against the revision that was read. A throwing store reports 'unavailable'; the
 * caller must not acknowledge or broadcast anything but 'ok' (PR-057).
 */
export async function commitAccepted(store: RoomStore, room: Room, readRevision: number): Promise<CommitOutcome> {
  try {
    return await store.update(room, readRevision);
  } catch {
    return 'unavailable';
  }
}
