import { BUILDINGS as buildings } from '../buildings/definitions.js';
import { validateSnapshot } from '../model/serialization.js';
import { confirmedWorkers } from '../roles/mayor/progress.js';
import type { BuildingType, GameState, Good, PlayerState, Role } from '../model/state.js';

export class InvariantError extends Error {
  constructor(readonly ruleId: string, detail: string) { super(`${ruleId}: ${detail}`); this.name = 'InvariantError'; }
}
function check(condition: boolean, ruleId: string, detail: string): asserts condition {
  if (!condition) throw new InvariantError(ruleId, detail);
}
const goods: Record<Good, number> = { corn:10,fruit:11,sugar:11,tobacco:9,coffee:9 };
const estates: Record<Good, number> = { corn:10,fruit:12,sugar:11,tobacco:9,coffee:8 };
export const workerCapacity = (type: BuildingType): number => buildings[type].workerSlots;
const baseRoles: readonly Role[] = ['planter','recruiter','builder','craftsman','trader','captain'];
const sum = (xs: readonly number[]): number => xs.reduce((a,b)=>a+b,0);
const citySize = (p: PlayerState): number => sum(p.buildings.map(b=>buildings[b.buildingTypeId].footprint));
const emptySlots = (p: PlayerState): number => p.countryside.filter(t=>!t.occupied).length
  + sum(p.buildings.map(b=>buildings[b.buildingTypeId].workerSlots-b.occupiedSlots));

/** Validates a single snapshot, not reachability or the legality of a transition. */
export function assertGameState(input: GameState): void {
  // Reuse PR-006's shape, versions, numeric ranges, IDs, and RNG checks.
  const s = validateSnapshot(input);
  const n = s.seatOrder.length;
  check(n>=3 && n<=5 && s.players.length===n, 'SETUP-001','player count');
  const byId = new Map(s.players.map(p=>[p.playerId,p]));
  check(s.seatOrder.every(id=>byId.has(id)), 'INVARIANT-002','seat/player references');
  const governor = s.seatOrder.indexOf(s.governorPlayerId);
  check(governor>=0, 'ROUND-001','governor reference');
  check(s.roleSelectionIndex<n, 'ROUND-001','role cursor');
  const chooser = s.seatOrder[(governor+s.roleSelectionIndex)%n]!;
  const phase = s.phase;
  const activeRole: Role | null = phase.kind==='phase-completion' ? phase.role
    : phase.kind.startsWith('planter-') ? 'planter'
    : phase.kind.startsWith('recruiter-') ? 'recruiter'
    : phase.kind.startsWith('builder-') ? 'builder'
    : phase.kind.startsWith('craftsman-') ? 'craftsman'
    : phase.kind.startsWith('trader-') ? 'trader'
    : phase.kind.startsWith('captain-') ? 'captain'
    : phase.kind==='adventurer' ? 'adventurer' : null;
  for (const role of [...baseRoles,'adventurer'] as const) {
    check(s.roleCards.filter(r=>r.kind===role).length===(role==='adventurer'?n-3:1),'SETUP-002','role card inventory');
  }
  const selected = s.roleCards.filter(r=>r.selectedBy!==null);
  const expected = phase.kind==='role-selection'?s.roleSelectionIndex:s.roleSelectionIndex+1;
  check(selected.length===expected,'ROUND-001','selected role count');
  const currentRole = selected.find(r=>r.selectedBy===chooser)?.kind;
  const selectedIds = selected.map(r=>r.selectedBy);
  check(new Set(selectedIds).size===selected.length,'ROUND-001','repeated chooser');
  for (let i=0;i<expected;i++) check(selectedIds.includes(s.seatOrder[(governor+i)%n]!), 'ROUND-001','chooser order');
  check(selected.every(r=>r.accumulatedCoins===0),'ROUND-001','selected card retains coins');
  if (phase.kind==='role-selection') check(phase.actorId===chooser,'ROUND-001','next chooser');
  if ('roleChooserId' in phase) check(phase.roleChooserId===chooser,'ROLE-001','role chooser');
  if (activeRole) check(selected.some(r=>r.selectedBy===chooser && r.kind===activeRole),'ROLE-001','selected role/phase mismatch');
  if ('actorIndex' in phase) {
    check(phase.actorIndex<n,'ROLE-001','actor cursor');
    check(phase.actorId===s.seatOrder[(governor+s.roleSelectionIndex+phase.actorIndex)%n],'ROLE-001','actor/offset mismatch');
    if (['recruiter-advantage','craftsman-bonus','adventurer'].includes(phase.kind)) check(phase.actorIndex===0,'ROLE-001','chooser-only decision');
  }
  if (phase.kind==='recruiter-placement') {
    check(s.supply.workRegisterCount===0,'RECRUITER-001','Register not distributed');
    const confirmed=confirmedWorkers(s);
    check(confirmed.length<n && new Set(confirmed).size===confirmed.length && confirmed.every(id=>s.seatOrder.includes(id)), 'RECRUITER-002','invalid confirmations');
    const start=s.seatOrder.indexOf(phase.roleChooserId);
    const next=Array.from({length:n},(_,i)=>s.seatOrder[(start+i)%n]!).find(id=>!confirmed.includes(id));
    check(phase.actorId===next,'RECRUITER-002','pending player cursor');
  }
  if (phase.kind==='round-completion') check(s.roleSelectionIndex===n-1,'ROUND-002','unfinished round');
  if ('acquiredTileIds' in phase) {
    const player=byId.get(phase.actorId)!;
    check(phase.acquiredTileIds.length<=2 && new Set(phase.acquiredTileIds).size===phase.acquiredTileIds.length
      && phase.acquiredTileIds.every(id=>player.countryside.some(t=>t.instanceId===id)), 'PLANTER-002','acquired tile references');
  }
  if ('chooserProducedTypes' in phase) check(new Set(phase.chooserProducedTypes).size===phase.chooserProducedTypes.length,'CRAFTSMAN-002','duplicate produced types');
  if (phase.kind==='captain-loading') check(phase.consecutiveNoLoads<n,'CAPTAIN-005','completed no-load traversal');
  check(s.estateMarket.length<=n+1,'PLANTER-003','market size');
  check(s.tradingHouse.length<=4,'TRADER-001','Trading House capacity');
  const expectedShips=[n+1,n+2,n+3];
  check(s.ships.length===3 && [...s.ships].map(x=>x.capacity).sort((a,b)=>a-b).every((x,i)=>x===expectedShips[i]),'SETUP-002','cargo capacities');
  check(s.ships.every(x=>x.loadedCount<=x.capacity),'CAPTAIN-002','overfilled cargo');
  const shipTypes=s.ships.flatMap(x=>x.goodType===null?[]:[x.goodType]);
  check(new Set(shipTypes).size===shipTypes.length,'CAPTAIN-002','duplicate cargo type');
  for (const p of s.players) {
    check(p.countryside.length<=12 && citySize(p)<=12,'INVARIANT-002','board capacity');
    check(new Set(p.buildings.map(b=>b.buildingTypeId)).size===p.buildings.length,'BUILDER-001','duplicate owned building type');
    check(p.buildings.every(b=>b.occupiedSlots<=buildings[b.buildingTypeId].workerSlots),'ROLE-002','building worker slots');
    const wharf=p.buildings.find(b=>b.buildingTypeId==='wharf');
    check(Boolean(wharf)===(p.personalShip!==null),'CAPTAIN-004','Wharf/Personal Ship ownership');
    if (p.personalShip) {
      check(p.personalShip.usedThisPhase===(p.personalShip.loadedCount>0),'CAPTAIN-004','Personal Ship use/cargo mismatch');
      if (p.personalShip.usedThisPhase) check(activeRole==='captain' && wharf!.occupiedSlots===1,'CAPTAIN-004','personal cargo outside active Wharf shipping');
    }
    // Only confirmed players, or everyone at Recruiter cleanup, must fill slots.
    const confirmed=(phase.kind==='recruiter-placement' && confirmedWorkers(s).includes(p.playerId))
      || (phase.kind==='phase-completion' && phase.role==='recruiter')
      || (phase.kind==='game-over' && currentRole==='recruiter');
    if (confirmed) check(p.idleWorkerCount===0 || emptySlots(p)===0,'RECRUITER-002','idle worker with empty slot after confirmation');
  }
  const allTiles=[...s.estateBag,...s.estateDiscard,...s.estateMarket,...s.players.flatMap(p=>p.countryside)];
  for (const good of Object.keys(goods) as Good[]) {
    const total=s.supply.goods[good]+sum(s.players.map(p=>p.goods[good]))
      +sum(s.ships.map(x=>x.goodType===good?x.loadedCount:0))
      +sum(s.players.map(p=>p.personalShip?.goodType===good?p.personalShip.loadedCount:0))
      +s.tradingHouse.filter(g=>g===good).length;
    check(total===goods[good],'INVARIANT-001',`${good} goods ledger`);
    check(allTiles.filter(t=>t.kind===good).length===estates[good],'INVARIANT-001',`${good} estate ledger`);
  }
  check(s.supply.quarryCount+allTiles.filter(t=>t.kind==='quarry').length===8,'INVARIANT-001','Quarry ledger');
  for (const type of Object.keys(buildings) as BuildingType[]) check(s.supply.buildingStock[type]
    +sum(s.players.map(p=>p.buildings.filter(b=>b.buildingTypeId===type).length))===buildings[type].stock,'INVARIANT-001',`${type} stock ledger`);
  const workers=s.supply.workerCount+s.supply.workRegisterCount+sum(s.players.map(p=>p.idleWorkerCount
    +p.countryside.filter(t=>t.occupied).length+sum(p.buildings.map(b=>b.occupiedSlots))));
  check(workers===(n===3?58:n===4?79:100),'INVARIANT-002','worker ledger');
  const initialVp=n===3?75:n===4?100:126;
  check(sum(s.players.map(p=>p.earnedVp))+s.supply.vpRemaining===initialVp+s.supply.vpOverflow,'INVARIANT-003','VP ledger');
  check(s.supply.vpOverflow===0 || s.supply.vpRemaining===0,'INVARIANT-003','overflow before exhaustion');
  for (const trigger of s.endTriggers) {
    check(trigger.triggeringRevision<=s.revision,'ENDGAME-001','future trigger');
    check(trigger.role===(phase.kind==='game-over'?currentRole:activeRole),'ENDGAME-002','trigger crossed role boundary');
    if (trigger.reason==='city-full') check(byId.has(trigger.playerId) && citySize(byId.get(trigger.playerId)!)===12,'ENDGAME-001','City trigger reference');
    if (trigger.reason==='vp-exhausted') check(s.supply.vpRemaining===0,'ENDGAME-001','VP trigger before exhaustion');
    if (trigger.reason==='worker-shortage') {
      const requested=Math.max(n,sum(s.players.flatMap(p=>p.buildings.map(b=>buildings[b.buildingTypeId].workerSlots-b.occupiedSlots))));
      check(s.supply.workerCount===0 && s.supply.workRegisterCount<requested && (phase.kind==='game-over' || phase.kind==='phase-completion'),'ENDGAME-001','premature worker shortage');
    }
  }
  for (const p of s.players) if (citySize(p)===12) check(s.endTriggers.some(t=>t.reason==='city-full' && t.playerId===p.playerId),'ENDGAME-001','missing full City trigger');
  if (s.supply.vpRemaining===0) check(s.endTriggers.some(t=>t.reason==='vp-exhausted'),'ENDGAME-001','missing VP trigger');
  if (phase.kind==='role-selection' || phase.kind==='round-completion') check(s.endTriggers.length===0,'ENDGAME-002','role advancement after trigger');
  if (phase.kind==='game-over') {
    if(currentRole==='captain') check(s.ships.every(ship=>ship.loadedCount<ship.capacity),'CAPTAIN-007','full cargo not cleaned up');
    check(s.endTriggers.length>0,'ENDGAME-002','game over without trigger');
    check(phase.scores.length===n && new Set(phase.scores.map(x=>x.playerId)).size===n,'SCORE-001','score player count');
    for (const score of phase.scores) {
      check(byId.has(score.playerId),'SCORE-001','score player reference');
      check(score.earnedVp===byId.get(score.playerId)!.earnedVp && score.totalVp===score.earnedVp+score.baseBuildingVp+sum(Object.values(score.bonuses)),'SCORE-001','score sum');
      check(score.rank<=n,'SCORE-002','rank range');
    }
  }
}
