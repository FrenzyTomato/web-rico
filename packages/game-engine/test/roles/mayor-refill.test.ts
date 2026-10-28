import { expect, it } from 'vitest';
import { applyCommand, createId } from '../../src/index.js';
import type { BuildingType, GameCommand, GameState } from '../../src/index.js';
import { fixture } from '../helpers/state.js';

const run = (s: GameState, c: GameCommand) => { const r = applyCommand(s, c); if (!r.ok) throw Error(r.error.message); return r.state; };

it('RECRUITER-004: six empty building slots put six workers on the ship, which the next Recruiter hands out', () => {
  const s = fixture(3);
  const give = (i: number, type: BuildingType) => {
    s.players[i]!.buildings.push({ instanceId: createId('building', `${type}-${i}`), buildingTypeId: type, occupiedSlots: 0 });
    s.supply.buildingStock[type]--;
  };
  give(0, 'large-tobacco-storage'); // 3 slots
  give(1, 'large-sugar-mill');      // 3 slots
  give(2, 'small-market');          // 1 slot
  const [p0, p1, p2] = s.seatOrder as [string, string, string];
  const supplyBefore = s.supply.workerCount;
  const ship = s.supply.workRegisterCount; // 3 at setup
  // Governor p0 takes Recruiter and the bonus worker: p0 gets 1 + 1, p1 and p2 get 1 each.
  let state = run(s as GameState, { kind: 'choose-role', actorId: p0 as never, roleCardId: s.roleCards[1]!.instanceId });
  state = run(state, { kind: 'recruit-worker', actorId: p0 as never, accept: true });
  // Plantations first, then one Tobacco Storage slot: 2 + 3 + 1 = 6 building slots stay empty.
  const allocate = (id: string, building: number) => {
    const p = state.players.find(x => x.playerId === id)!;
    state = run(state, { kind: 'allocate-workers', actorId: id as never, allocation: {
      countryside: p.countryside.map(t => ({ tileId: t.instanceId, occupied: true })),
      buildings: p.buildings.map(b => ({ buildingId: b.instanceId, occupiedSlots: building })), idleCount: 0 } });
  };
  allocate(p0, 1); allocate(p1, 0); allocate(p2, 0);
  const empty = state.players.reduce((n, p) => n + p.buildings.reduce((m, b) => m + ({ 'large-tobacco-storage': 3, 'large-sugar-mill': 3, 'small-market': 1 } as Record<string, number>)[b.buildingTypeId]! - b.occupiedSlots, 0), 0);
  console.log(`empty building slots after recruiting: ${empty}; ship now: ${state.supply.workRegisterCount}; supply ${supplyBefore} -> ${state.supply.workerCount} (bonus 1 + refill)`);
  expect(empty).toBe(6);
  expect(state.supply.workRegisterCount).toBe(6);
  expect(state.supply.workerCount).toBe(supplyBefore - 1 - 6);
  expect(ship).toBe(3);

  // Next Recruiter (p1 chooses, declines the bonus): the six ship workers go 2/2/2 into the players' pools.
  const idleBefore = state.players.map(p => p.idleWorkerCount);
  // Skip to a new round with p1 as Governor, so Recruiter is available again.
  state = { ...state, roundNumber: 2, roleSelectionIndex: 0, governorPlayerId: p1 as never, phase: { kind: 'role-selection', actorId: p1 as never },
    roleCards: state.roleCards.map(c => ({ ...c, selectedBy: null })) } as GameState;
  state = run(state, { kind: 'choose-role', actorId: p1 as never, roleCardId: s.roleCards[1]!.instanceId });
  state = run(state, { kind: 'recruit-worker', actorId: p1 as never, accept: false });
  const received = state.players.map((p, i) => p.idleWorkerCount - idleBefore[i]!);
  console.log(`workers received at the next Recruiter: ${received.join('/')}`);
  expect(received).toEqual([2, 2, 2]);
});
