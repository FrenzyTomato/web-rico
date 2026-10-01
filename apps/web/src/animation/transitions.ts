import type { PlayerEvent } from '@vibe-rico/protocol';

/**
 * The scene object an event briefly highlights (a `targetKey` from scene/Selection), or null for events
 * with no on-table object. Animation is visual only: the scene always draws the latest snapshot.
 */
export function effectFor(e: PlayerEvent): string | null {
  switch (e.kind) {
    case 'role-selected': return `role:${e.cardId}`;
    case 'building-built': return `building:${e.building.buildingTypeId}`;
    case 'tile-placed': return `tile:${e.tile.instanceId}`;
    case 'goods-moved': return e.to.kind === 'cargo-ship' ? `ship:${e.to.shipId}` : null;
    default: return null;
  }
}
