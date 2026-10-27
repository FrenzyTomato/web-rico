import { createGame, createId, getLegalCommands, RULESET } from '@vibe-rico/game-engine';
import type { GameState, GameCommand, Role } from '@vibe-rico/game-engine';

export const learner = createId('player', 'alice');
export function initialTutorialGame(): GameState {
  const result = createGame({ rulesetId: RULESET.id, gameId: createId('game', 'tutorial'), seatOrder: [learner, createId('player', 'bruno'), createId('player', 'chen')], governorPlayerId: learner, seed: 1897 });
  if (!result.ok) throw Error(result.error.message);
  return result.state;
}
const rounds: readonly (readonly Role[])[] = [['planter', 'builder', 'recruiter'], ['recruiter', 'trader', 'craftsman'], ['trader', 'captain']];
export const tutorialComplete = (state: GameState) => state.roundNumber === 3 && state.roleSelectionIndex === 2 && state.phase.kind === 'role-selection';

/** Guided choices only. The engine still validates and executes every player/bot move at runtime. */
export function nextTutorialCommand(state: GameState): GameCommand | null {
  if (tutorialComplete(state)) return null;
  const legal = state.seatOrder.flatMap(id => getLegalCommands(state, id))[0];
  if (!legal) throw Error('No tutorial decision');
  const actorId = legal.actorId;
  const me = state.players.find(p => p.playerId === actorId)!;
  const roleIndex = (state.roundNumber - 1) * 3 + state.roleSelectionIndex + 1;
  let command: GameCommand;
  switch (legal.phase) {
    case 'role-selection': {
      const role = rounds[state.roundNumber - 1]?.[state.roleSelectionIndex];
      const card = state.roleCards.find(c => c.kind === role && c.selectedBy === null);
      if (!card) throw Error(`Missing role ${role}`);
      command = { kind: 'choose-role', actorId, roleCardId: card.instanceId };
      break;
    }
    case 'planter-choice': {
      const corn = state.estateMarket.find(t => t.kind === 'corn');
      if (actorId === 'alice' && !corn) throw Error('Lesson needs corn');
      command = { kind: 'plant', actorId, choice: { kind: 'estate', tileId: actorId === 'alice' ? corn!.instanceId : state.estateMarket.find(t => t.kind === (actorId === 'chen' ? 'corn' : 'fruit'))?.instanceId ?? state.estateMarket[0]!.instanceId } };
      break;
    }
    case 'builder-choice':
      command = { kind: 'build', actorId, purchase: { buildingTypeId: actorId === 'bruno' ? 'small-fruit-depot' : 'small-market', useAdvantage: actorId === 'bruno', useSchool: false } };
      break;
    case 'recruiter-advantage': command = { kind: 'recruit-worker', actorId, accept: true }; break;
    case 'recruiter-placement': {
      let remaining = legal.totalWorkers;
      // The learner staffs corn, then Small Market. Opponents first staff fruit, then add buildings.
      const preferred = roleIndex <= 3 && actorId !== learner ? me.countryside.map(t => t.instanceId) : [
        ...me.countryside.filter(t => t.kind === 'corn').map(t => t.instanceId),
        ...me.buildings.map(b => b.instanceId), ...me.countryside.filter(t => t.kind !== 'corn').map(t => t.instanceId),
      ];
      const counts = new Map<string, number>();
      for (const key of preferred) {
        const capacity = legal.slots.find(s => s.instanceId === key)!.capacity;
        const count = Math.min(remaining, capacity); counts.set(key, count); remaining -= count;
      }
      command = { kind: 'allocate-workers', actorId, allocation: {
        countryside: me.countryside.map(t => ({ tileId: t.instanceId, occupied: counts.get(t.instanceId) === 1 })),
        buildings: me.buildings.map(b => ({ buildingId: b.instanceId, occupiedSlots: counts.get(b.instanceId) ?? 0 })), idleCount: remaining,
      } };
      break;
    }
    case 'craftsman-production':
      command = { kind: 'produce', actorId, production: { accept: true, useFactory: false } };
      break;
    case 'craftsman-bonus':
      command = { kind: 'take-production-bonus', actorId, good: 'corn' };
      break;
    case 'trader-choice':
      command = { kind: 'trade', actorId, sale: actorId === 'alice' && me.goods.corn > 0 ? { good: 'corn', useAdvantage: false, useSmallMarket: true, useLargeMarket: false } : null };
      break;
    case 'captain-loading':
      command = { kind: 'load', actorId, shipment: legal.loads[0]!.shipment, useHarbor: false };
      break;
    case 'captain-retention': {
      const good = (Object.keys(legal.available) as (keyof typeof legal.available)[]).find(g => legal.available[g] > 0);
      command = { kind: 'retain', actorId, retained: { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0, ...(good ? { [good]: 1 } : {}) }, warehouseTypes: [] }; break;
    }
    default: throw Error(`Unexpected tutorial phase: ${legal.phase}`);
  }
  return command;
}
