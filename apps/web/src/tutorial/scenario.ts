import { createGame, createId, getLegalCommands, RULESET } from '@vibe-rico/game-engine';
import type { BuildingType, GameState, GameCommand, Role } from '@vibe-rico/game-engine';

export const learner = createId('player', 'alice');
export function initialTutorialGame(): GameState {
  const result = createGame({ rulesetId: RULESET.id, gameId: createId('game', 'tutorial'), seatOrder: [learner, createId('player', 'bruno'), createId('player', 'chen')], governorPlayerId: learner, seed: 1897 });
  if (!result.ok) throw Error(result.error.message);
  return result.state;
}
/**
 * The lesson, one list per round (Governor first): you take a quarry, everyone builds (you a Small Fruit Depot), two
 * Recruiters staff your fruit estate and depot, a Craftsman produces, you sell fruit (Bruno's fruit is then shut out),
 * a third Recruiter staffs your quarry, you build with the quarry and Builder discounts, a Craftsman produces again,
 * and you finish as Captain.
 */
const rounds: readonly (readonly Role[])[] = [['planter', 'builder', 'recruiter'], ['recruiter', 'craftsman', 'trader'], ['recruiter', 'builder', 'craftsman'], ['captain']];
export const tutorialComplete = (state: GameState) => state.roundNumber === 4 && state.roleSelectionIndex === 1 && state.phase.kind === 'role-selection';
/** What each player buys, in order of preference; the chooser always takes the Builder discount. */
const builds: Record<string, readonly BuildingType[]> = {
  alice: ['small-fruit-depot', 'small-warehouse'], bruno: ['small-fruit-depot', 'small-market'], chen: ['small-market'],
};

/** Guided choices only. The engine still validates and executes every player/bot move at runtime. */
export function nextTutorialCommand(state: GameState): GameCommand | null {
  if (tutorialComplete(state)) return null;
  const legal = state.seatOrder.flatMap(id => getLegalCommands(state, id))[0];
  if (!legal) throw Error('No tutorial decision');
  const actorId = legal.actorId;
  const me = state.players.find(p => p.playerId === actorId)!;
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
      // You take the quarry (the chooser's privilege); Bruno prefers corn and Chen sugar, else the first estate.
      const want = actorId === learner ? null : actorId === 'bruno' ? 'corn' : 'sugar';
      const estate = state.estateMarket.find(t => t.kind === want) ?? state.estateMarket[0]!;
      command = { kind: 'plant', actorId, choice: want === null ? { kind: 'quarry' } : { kind: 'estate', tileId: estate.instanceId } };
      break;
    }
    case 'builder-choice': {
      const owned = new Set(me.buildings.map(b => b.buildingTypeId));
      const type = builds[actorId]!.find(t => !owned.has(t) && legal.purchases.some(p => p.buildingTypeId === t));
      const offer = type && legal.purchases.filter(p => p.buildingTypeId === type).sort((x, y) => x.price - y.price)[0];
      command = { kind: 'build', actorId, purchase: offer ? { buildingTypeId: offer.buildingTypeId, useAdvantage: offer.useAdvantage, useSchool: false } : null };
      break;
    }
    case 'recruiter-advantage': command = { kind: 'recruit-worker', actorId, accept: true }; break;
    case 'recruiter-placement': {
      let remaining = legal.totalWorkers;
      // You staff the fruit estate, then the Small Fruit Depot, then the quarry. Opponents fill estates, then buildings.
      const preferred = actorId !== learner ? [...me.countryside.map(t => t.instanceId), ...me.buildings.map(b => b.instanceId)] : [
        ...me.countryside.filter(t => t.kind === 'fruit').map(t => t.instanceId),
        ...me.buildings.filter(b => b.buildingTypeId === 'small-fruit-depot').map(b => b.instanceId),
        ...me.countryside.filter(t => t.kind !== 'fruit').map(t => t.instanceId),
        ...me.buildings.filter(b => b.buildingTypeId !== 'small-fruit-depot').map(b => b.instanceId),
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
      command = { kind: 'take-production-bonus', actorId, good: legal.goods.find(g => g !== null) ?? null };
      break;
    case 'trader-choice': {
      // You sell fruit at the best price on offer; the bots keep their goods, so the guide can show fruit is now shut out.
      const sale = actorId === learner ? legal.sales.filter(o => o.good === 'fruit').sort((x, y) => y.price - x.price)[0] : undefined;
      command = { kind: 'trade', actorId, sale: sale ? { good: sale.good, useAdvantage: sale.useAdvantage, useSmallMarket: sale.useSmallMarket, useLargeMarket: sale.useLargeMarket } : null };
      break;
    }
    case 'captain-loading': {
      const load = legal.loads.find(l => l.shipment.good === 'fruit') ?? legal.loads[0]!;
      command = { kind: 'load', actorId, shipment: load.shipment, useHarbor: false };
      break;
    }
    case 'captain-retention': {
      const good = (Object.keys(legal.available) as (keyof typeof legal.available)[]).find(g => legal.available[g] > 0);
      command = { kind: 'retain', actorId, retained: { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0, ...(good ? { [good]: 1 } : {}) }, warehouseTypes: [] }; break;
    }
    default: throw Error(`Unexpected tutorial phase: ${legal.phase}`);
  }
  return command;
}
