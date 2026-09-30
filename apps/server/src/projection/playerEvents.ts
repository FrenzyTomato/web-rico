import type { GameEvent, PlayerId } from '@vibe-rico/game-engine';
import type { PlayerEvent } from '@vibe-rico/protocol';

/** VISIBILITY-002/003: `vp-earned` reaches only its owner; kept events keep their canonical revision/index. */
export function eventsForPlayer(events: readonly GameEvent[], viewerId: PlayerId): PlayerEvent[] {
  return events.filter(e => e.kind !== 'vp-earned' || e.playerId === viewerId);
}
