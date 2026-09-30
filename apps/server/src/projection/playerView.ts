import type { GameState, PlayerId } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';

/**
 * PROTOCOL.md "Player-view and privacy contract". Fields are copied one by one, never spread, so a new
 * GameState field (rng, estateBag, metadata) cannot reach a player unnoticed.
 */
export function projectForPlayer(state: GameState, viewerId: PlayerId): PlayerView {
  return {
    viewer: { playerId: viewerId, earnedVp: state.players.find(p => p.playerId === viewerId)!.earnedVp },
    seatOrder: state.seatOrder,
    players: state.players.map(p => ({ playerId: p.playerId, coins: p.coins, countryside: p.countryside, buildings: p.buildings,
      idleWorkerCount: p.idleWorkerCount, goods: p.goods, personalShip: p.personalShip })),
    governorPlayerId: state.governorPlayerId,
    roundNumber: state.roundNumber,
    roleSelectionIndex: state.roleSelectionIndex,
    roleCards: state.roleCards,
    phase: state.phase,
    supply: state.supply,
    estateMarket: state.estateMarket,
    estateDiscard: state.estateDiscard,
    endTriggers: state.endTriggers,
    ships: state.ships,
    tradingHouse: state.tradingHouse,
  };
}
