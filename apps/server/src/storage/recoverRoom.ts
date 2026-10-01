import type { RoomLifecycle } from '../rooms/lifecycle.js';
import type { RoomStore } from '../rooms/store.js';

/**
 * Restart recovery (PR-058). Rooms, snapshots, seat token hashes and processed commands live in the store,
 * so requests after a restart read them directly; only in-memory presence is rebuilt here. Every stored room
 * starts empty, so players get the full empty-room TTL to resume with their tokens.
 */
export async function recoverRooms(store: RoomStore, lifecycle: RoomLifecycle): Promise<number> {
  const ids = await store.listRoomIds();
  for (const id of ids) lifecycle.recovered(id);
  return ids.length;
}
