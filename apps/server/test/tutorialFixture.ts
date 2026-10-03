import { applyCommand, createGame, getLegalCommands, createId, RULESET } from '@vibe-rico/game-engine';
import type { GameCommand, GameState, Role } from '@vibe-rico/game-engine';
import { broadcastFor } from '../src/rooms/broadcast.js';

/** Authored, reproducible lesson. Every transition goes through the real rules engine. */
export function tutorialFixture() {
  const learner = createId('player', 'alice');
  const initial = createGame({ rulesetId: RULESET.id, gameId: createId('game', 'tutorial'), seatOrder: [learner, createId('player', 'bruno'), createId('player', 'chen')], governorPlayerId: learner, seed: 1897 });
  if (!initial.ok) throw Error(initial.error.message);
  let state: GameState = initial.state;
  const steps: { id: string; before: ReturnType<typeof broadcastFor>; action: Omit<GameCommand, 'actorId'>; after: ReturnType<typeof broadcastFor> }[] = [];
  const roles: Role[] = ['planter', 'builder', 'recruiter', 'recruiter', 'trader', 'craftsman', 'trader', 'captain'];
  let roleIndex = 0;
  for (let guard = 0; guard < 100; guard++) {
    const legal = state.seatOrder.flatMap(id => getLegalCommands(state, id))[0];
    if (!legal) throw Error('No tutorial decision');
    const actorId = legal.actorId;
    const me = state.players.find(p => p.playerId === actorId)!;
    let command: GameCommand;
    let id = '';
    switch (legal.phase) {
      case 'role-selection': {
        const role = roles[roleIndex++];
        const card = state.roleCards.find(c => c.kind === role && c.selectedBy === null);
        if (!card) throw Error(`Missing role ${role}`);
        command = { kind: 'choose-role', actorId, roleCardId: card.instanceId };
        if (roleIndex === 1) id = 'role';
        break;
      }
      case 'planter-choice': {
        const corn = state.estateMarket.find(t => t.kind === 'corn');
        if (actorId === 'alice' && !corn) throw Error('Lesson needs corn');
        command = { kind: 'plant', actorId, choice: actorId === 'alice' ? { kind: 'estate', tileId: corn!.instanceId } : { kind: 'decline' } };
        if (actorId === 'alice') id = 'estate';
        break;
      }
      case 'builder-choice':
        command = { kind: 'build', actorId, purchase: actorId === 'alice' ? { buildingTypeId: 'small-market', useAdvantage: false, useSchool: false } : null };
        if (actorId === 'alice') id = 'build';
        break;
      case 'recruiter-advantage': command = { kind: 'recruit-worker', actorId, accept: true }; break;
      case 'recruiter-placement': {
        let remaining = legal.totalWorkers;
        // First recruitment staffs fruit; the teaching checkpoint relocates that worker to corn.
        const preferred = roleIndex <= 3 ? me.countryside.map(t => t.instanceId) : [
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
        if (actorId === 'alice' && roleIndex === 4) id = 'workers';
        break;
      }
      case 'craftsman-production':
        command = { kind: 'produce', actorId, production: { accept: true, useFactory: false } };
        if (actorId === 'alice') id = 'produce';
        break;
      case 'craftsman-bonus':
        command = { kind: 'take-production-bonus', actorId, good: 'corn' };
        if (actorId === 'alice') id = 'bonus';
        break;
      case 'trader-choice':
        command = { kind: 'trade', actorId, sale: actorId === 'alice' && me.goods.corn > 0 ? { good: 'corn', useAdvantage: false, useSmallMarket: true, useLargeMarket: false } : null };
        if (actorId === 'alice' && me.goods.corn > 0) id = 'trade';
        break;
      case 'captain-loading':
        command = { kind: 'load', actorId, shipment: legal.loads[0]!.shipment, useHarbor: false };
        if (actorId === 'alice') id = 'ship';
        break;
      default: throw Error(`Unexpected tutorial phase: ${legal.phase}`);
    }
    const before = broadcastFor(state, [], learner);
    const result = applyCommand(state, command);
    if (!result.ok) throw Error(`${id || command.kind}: ${result.error.message} ${JSON.stringify({legal, me})}`);
    state = result.state;
    if (id) {
      const { actorId: _, ...action } = command;
      steps.push({ id, before, action, after: broadcastFor(state, result.events, learner) });
    }
    if (id === 'ship') return steps;
  }
  throw Error('Tutorial exceeded its bounded script');
}
