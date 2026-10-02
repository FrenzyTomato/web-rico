import { expect, it } from 'vitest';
import { applyCommand, assertGameState, confirmedWorkers, createGame, createId, deserializeGame, getLegalCommands, serializeGame } from '../../src/index.js';
import type { GameCommand, GameState, Good, LegalAction } from '../../src/index.js';
import { expectLedgers, independentScores } from '../helpers/verify.js';

// Bounded random legal-action checks (TS-REPLAY property layer). Reaching the step limit is diagnostic,
// never evidence of a complete game; complete-game acceptance is the fixed histories in full-games.test.ts.
const STEPS = 400;
const GOODS: readonly Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];

/** Test-local mulberry32, independent of the engine RNG. */
function random(seed: number) {
  let t = seed >>> 0;
  const next = () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  const int = (n: number) => Math.floor(next() * n);
  const pick = <T>(xs: readonly T[]): T => { if (xs.length === 0) throw Error('empty legal options'); return xs[int(xs.length)]!; };
  return { int, pick };
}
type Random = ReturnType<typeof random>;

/** Builds one random command inside a legal-action descriptor; applyCommand must accept it. */
function randomCommand(state: GameState, a: LegalAction, r: Random): GameCommand {
  const actorId = a.actorId;
  switch (a.phase) {
    case 'role-selection': return { kind: 'choose-role', actorId, roleCardId: r.pick(a.roleCardIds) };
    case 'planter-before': return { kind: 'use-hacienda', actorId, accept: r.pick(a.accept) };
    case 'planter-choice': return { kind: 'plant', actorId, choice: r.pick(a.choices) };
    case 'planter-worker': return { kind: 'use-hospital', actorId, tileId: r.pick(a.tileIds) };
    case 'recruiter-advantage': return { kind: 'recruit-worker', actorId, accept: r.pick(a.accept) };
    case 'recruiter-placement': {
      // Idle workers are legal only once every slot is full; otherwise fill a random set of slot units.
      const units = a.slots.flatMap(s => Array.from({ length: s.capacity }, () => s.instanceId));
      for (let i = units.length - 1; i > 0; i--) { const j = r.int(i + 1); [units[i], units[j]] = [units[j]!, units[i]!]; }
      const used = units.slice(0, a.totalWorkers);
      const count = (id: string) => used.filter(u => u === id).length;
      const p = state.players.find(x => x.playerId === actorId)!;
      return { kind: 'allocate-workers', actorId, allocation: {
        countryside: p.countryside.map(t => ({ tileId: t.instanceId, occupied: count(t.instanceId) === 1 })),
        buildings: p.buildings.map(b => ({ buildingId: b.instanceId, occupiedSlots: count(b.instanceId) })),
        idleCount: a.totalWorkers - used.length } };
    }
    case 'builder-choice': {
      const o = r.pick([null, ...a.purchases]);
      return { kind: 'build', actorId, purchase: o && { buildingTypeId: o.buildingTypeId, useAdvantage: o.useAdvantage, useSchool: r.pick(o.schoolChoices) } };
    }
    case 'craftsman-production':
      return { kind: 'produce', actorId, production: r.pick([{ accept: false as const }, ...a.factoryChoices.map(useFactory => ({ accept: true as const, useFactory }))]) };
    case 'craftsman-bonus': return { kind: 'take-production-bonus', actorId, good: r.pick(a.goods) };
    case 'trader-choice': {
      const o = r.pick([null, ...a.sales]);
      return { kind: 'trade', actorId, sale: o && { good: o.good, useAdvantage: o.useAdvantage, useSmallMarket: o.useSmallMarket, useLargeMarket: o.useLargeMarket } };
    }
    case 'captain-loading': {
      const choices: GameCommand[] = a.loads.map(l => ({ kind: 'load', actorId, shipment: l.shipment, useHarbor: r.pick(a.harborChoices) }));
      if (a.canDeclineWharf) choices.push({ kind: 'decline-wharf', actorId });
      return r.pick(choices);
    }
    case 'captain-retention': {
      const owned = GOODS.filter(g => a.available[g] > 0);
      const types = owned.filter(() => r.int(2) === 1).slice(0, a.maxWarehouseTypes);
      const retained = { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
      for (const g of types) retained[g] = r.int(a.available[g] + 1);
      const rest = owned.filter(g => !types.includes(g));
      if (rest.length > 0 && r.int(2) === 1) retained[r.pick(rest)] = 1;
      return { kind: 'retain', actorId, retained, warehouseTypes: types };
    }
    case 'adventurer': return { kind: 'take-adventurer-coin', actorId, accept: r.pick(a.accept) };
  }
}

it.each([3, 4, 5].flatMap(n => [11, 29, 47].map(seed => ({ n, seed }))))('bounded random legal play keeps invariants: $n players, seed $seed', ({ n, seed }) => {
  const seats = Array.from({ length: n }, (_, i) => createId('player', `p${i}`));
  const created = createGame({ rulesetId: 'puerto-rico-1897-special-edition-base-en', gameId: createId('game', 'property'), seatOrder: seats, governorPlayerId: seats[0]!, seed });
  if (!created.ok) throw Error(created.error.message);
  const r = random(seed * 7919 + n);
  let state = created.state;
  for (let step = 0; step < STEPS && state.phase.kind !== 'game-over'; step++) {
    const holders = seats.filter(id => getLegalCommands(state, id).length > 0);
    expect(holders, `step ${step}`).toEqual(state.phase.kind === 'recruiter-placement' ? seats.filter(id => !confirmedWorkers(state).includes(id)) : ['actorId' in state.phase ? state.phase.actorId : null]);
    const actions = getLegalCommands(state, r.pick(holders));
    expect(actions).toHaveLength(1);
    const command = randomCommand(state, actions[0]!, r);
    const before = serializeGame(state);
    // Every non-actor submission is rejected without changing the state.
    const other = seats.find(id => !holders.includes(id));
    if (other) expect(applyCommand(state, { ...command, actorId: other } as GameCommand)).toMatchObject({ ok: false, error: { code: 'WRONG_ACTOR' } });
    const result = applyCommand(state, command);
    if (!result.ok) throw Error(`step ${step} generated command rejected: ${JSON.stringify(command)} ${result.error.message}`);
    expect(serializeGame(state)).toBe(before);
    expect(result.state.revision).toBe(state.revision + 1);
    expect(result.events.map(e => [e.index, e.revision])).toEqual(result.events.map((_, i) => [i, result.state.revision]));
    assertGameState(result.state);
    expectLedgers(result.state);
    expect(applyCommand(deserializeGame(before), command)).toEqual(result);
    state = result.state;
  }
  if (state.phase.kind === 'game-over') {
    expect(state.phase.scores).toEqual(independentScores(state));
    for (const id of seats) expect(getLegalCommands(state, id)).toEqual([]);
  }
});
