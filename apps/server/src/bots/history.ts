import type { GameState, PlayerId } from '@vibe-rico/game-engine';
import { eventsForPlayer } from '../projection/playerEvents.js';
import type { AcceptedCommand } from '../rooms/store.js';

/** A player's public record, as any seat could have tracked it. Built from the bot's own event view. */
export interface PlayerProfile {
  readonly player: string;
  readonly rolesChosen: readonly string[];
  readonly plantations: readonly string[];
  readonly quarries: number;
  readonly buildingsBought: readonly string[];
  readonly shippedBarrels: number;
  readonly soldGoods: number;
  readonly coins: number;
}

export function profiles(state: GameState, history: readonly AcceptedCommand[], viewer: PlayerId,
  names: Readonly<Record<string, string>>): Record<PlayerId, PlayerProfile> {
  const out = new Map(state.players.map(p => [p.playerId, {
    // Plantations and quarries are on the table, so the current island is used rather than the event log.
    player: names[p.playerId] ?? p.playerId, rolesChosen: [] as string[],
    plantations: p.countryside.filter(t => t.kind !== 'quarry').map(t => t.kind), quarries: p.countryside.filter(t => t.kind === 'quarry').length,
    buildingsBought: [] as string[], shippedBarrels: 0, soldGoods: 0, coins: p.coins,
  }]));
  // Hidden events (others' VP chips) are filtered exactly as for the bot's own client.
  for (const event of history.flatMap(c => eventsForPlayer(c.events, viewer))) {
    switch (event.kind) {
      case 'role-selected': out.get(event.playerId)?.rolesChosen.push(event.role); break;
      case 'building-built': out.get(event.playerId)?.buildingsBought.push(event.building.buildingTypeId); break;
      case 'goods-moved': {
        const from = event.from.kind === 'player' ? out.get(event.from.playerId) : undefined;
        if (!from) break;
        if (event.to.kind === 'cargo-ship' || event.to.kind === 'personal-ship') from.shippedBarrels += event.quantity;
        else if (event.to.kind === 'trading-house') from.soldGoods += event.quantity;
        break;
      }
      default: break;
    }
  }
  return Object.fromEntries(out);
}
