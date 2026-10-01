import { describe, expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands } from '../../src/index.js';
import type { BuildingType, GameCommand, GameState, Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
import type { Mutable } from '../helpers/state.js';

// PR-060A: regression tests for the PR-060 audit findings (docs/RULE_AUDIT.md). Expected values are
// derived from the cited rulebook pages, not from the implementation.
type S = Mutable<GameState>;
function own(s: S, seat: number, type: BuildingType, occupied: boolean) {
  s.players[seat]!.buildings.push({ instanceId: createId('building', `${type}-${seat}`), buildingTypeId: type, occupiedSlots: Number(occupied) });
  s.supply.buildingStock[type]--;
  s.supply.workerCount -= Number(occupied);
  if (type === 'wharf') s.players[seat]!.personalShip = { goodType: null, loadedCount: 0, usedThisPhase: false };
}
function give(s: S, seat: number, good: Good, n: number) { s.players[seat]!.goods[good] += n; s.supply.goods[good] -= n; }
function ship(s: S, i: number, good: Good, n: number) { s.ships[i] = { ...s.ships[i]!, goodType: good, loadedCount: n }; s.supply.goods[good] -= n; }
function apply(s: GameState, command: GameCommand) {
  const r = applyCommand(s, command);
  if (!r.ok) throw Error(`${command.kind}: ${r.error.message}`);
  assertGameState(r.state);
  return r.state;
}
const captain = (s: S, actor: number) => {
  s.roleCards[5]!.selectedBy = s.seatOrder[0]!;
  s.phase = { kind: 'captain-loading', actorId: s.seatOrder[actor]!, roleChooserId: s.seatOrder[0]!, actorIndex: actor, captainBonusUsed: false, consecutiveNoLoads: 0 };
};

describe('PR-060 audit regressions', () => {
  it('AUD-01 (p.21 Wharf "at any time"): after a cargo load, the Wharf is offered on the owner’s next visit', () => {
    const s = fixture(3);
    captain(s, 0);
    own(s, 0, 'wharf', true);
    ship(s, 0, 'tobacco', 4); ship(s, 2, 'coffee', 6); // only the 5-hold ship is open
    give(s, 0, 'sugar', 5); give(s, 0, 'corn', 3);
    const after = apply(s, { kind: 'load', actorId: s.seatOrder[0]!, shipment: { kind: 'cargo', shipId: s.ships[1]!.instanceId, good: 'sugar' }, useHarbor: false });
    // B and C have nothing to load; A's next visit cannot load corn on any cargo ship, but the Wharf can take it.
    expect(after.phase).toMatchObject({ kind: 'captain-loading', actorId: s.seatOrder[0] });
    expect(getLegalCommands(after, s.seatOrder[0]!)).toMatchObject([{ loads: [{ shipment: { kind: 'personal', good: 'corn' }, quantity: 3 }], canDeclineWharf: true }]);
  });

  it.each([false, true])('AUD-02 (p.21/p.19 Harbor is optional): using Harbor=%s decides whether the VP supply is exhausted', useHarbor => {
    const s = fixture(3);
    captain(s, 1);
    own(s, 1, 'harbor', true);
    give(s, 1, 'corn', 3);
    s.supply.vpRemaining = 4; s.players[2]!.earnedVp = 71;
    const after = apply(s, { kind: 'load', actorId: s.seatOrder[1]!, shipment: { kind: 'cargo', shipId: s.ships[0]!.instanceId, good: 'corn' }, useHarbor });
    // 3 crates (+1 with Harbor); not the Captain, so no privilege point.
    expect(after.supply.vpRemaining).toBe(useHarbor ? 0 : 1);
    expect(after.endTriggers.map(t => t.reason)).toEqual(useHarbor ? ['vp-exhausted'] : []);
  });

  it.each([true, false])('AUD-03 (p.10/p.11): accepting the Recruiter worker=%s decides a worker shortage at refill', accept => {
    const s = fixture(3);
    // Register 3, supply 3, no buildings (so no empty building slots); the remaining workers sit idle on A's full slot.
    s.supply.workRegisterCount = 3; s.supply.workerCount = 3;
    s.players[0]!.countryside[0]!.occupied = true; s.players[0]!.idleWorkerCount = 58 - 3 - 3 - 1;
    s.roleCards[1]!.selectedBy = s.seatOrder[0]!;
    s.phase = { kind: 'recruiter-advantage', actorId: s.seatOrder[0]!, roleChooserId: s.seatOrder[0]!, actorIndex: 0 };
    let state = apply(s, { kind: 'recruit-worker', actorId: s.seatOrder[0]!, accept });
    // Every player confirms a full allocation: fill each slot, the rest idle.
    while (state.phase.kind === 'recruiter-placement') {
      const legal = getLegalCommands(state, state.phase.actorId)[0];
      if (legal?.phase !== 'recruiter-placement') throw Error('placement');
      let left = legal.totalWorkers;
      const filled = legal.slots.map(slot => { const n = Math.min(left, slot.capacity); left -= n; return n; });
      state = apply(state, { kind: 'allocate-workers', actorId: legal.actorId, allocation: {
        countryside: legal.slots.flatMap((slot, i) => slot.kind === 'countryside' ? [{ tileId: slot.instanceId, occupied: filled[i] === 1 }] : []),
        buildings: legal.slots.flatMap((slot, i) => slot.kind === 'building' ? [{ buildingId: slot.instanceId, occupiedSlots: filled[i]! }] : []),
        idleCount: left } });
    }
    // Refill wants max(3 players, 0 empty building slots) = 3; the supply holds 2 after the extra worker, 3 without it.
    expect(state.endTriggers.map(t => t.reason)).toEqual(accept ? ['worker-shortage'] : []);
    expect(state.phase.kind).toBe(accept ? 'game-over' : 'role-selection');
  });

  it('AUD-07 (p.11): four occupied Quarries discount large buildings by 4, others up to their own cap', () => {
    const s = fixture(3);
    s.roleCards[2]!.selectedBy = s.seatOrder[0]!;
    s.phase = { kind: 'builder-choice', actorId: s.seatOrder[0]!, roleChooserId: s.seatOrder[0]!, actorIndex: 0 };
    for (let i = 1; i <= 4; i++) s.players[0]!.countryside.push({ instanceId: createId('tile', `q${i}`), kind: 'quarry', occupied: true });
    s.supply.quarryCount -= 4; s.supply.workerCount -= 4; s.players[0]!.coins = 10;
    const legal = getLegalCommands(s, s.seatOrder[0]!)[0];
    if (legal?.phase !== 'builder-choice') throw Error('builder');
    const price = (type: BuildingType, useAdvantage: boolean) => legal.purchases.find(p => p.buildingTypeId === type && p.useAdvantage === useAdvantage)?.price;
    // City Hall 10 − 4 = 6 (−1 privilege = 5); Harbor 8 − 3 = 5; Office 5 − 2 = 3; Builder's Yard 2 − 1 = 1.
    expect([price('city-hall', false), price('city-hall', true), price('harbor', false), price('office', false), price('builders-yard', false)]).toEqual([6, 5, 5, 3, 1]);
  });
});
