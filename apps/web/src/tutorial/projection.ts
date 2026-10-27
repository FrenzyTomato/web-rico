import { getLegalCommands } from '@vibe-rico/game-engine';
import type { GameState, PlayerId } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';

/** Public view of this local simulation; real room views still come only from the server. */
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

export function tutorialBroadcast(state: GameState, events: readonly import('@vibe-rico/game-engine').GameEvent[] = []): import('@vibe-rico/protocol').PlayerBroadcast {
  const viewer = state.seatOrder[0]!;
  return { protocolVersion: '1', revision: state.revision, view: projectForPlayer(state, viewer), legalActions: getLegalCommands(state, viewer), events: events.filter(e => e.kind !== 'vp-earned' || e.playerId === viewer) };
}
