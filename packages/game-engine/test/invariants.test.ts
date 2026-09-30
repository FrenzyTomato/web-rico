import { expect, it } from 'vitest';
import { assertGameState, createId } from '../src/index.js';
import type { GameState, BuildingType, GamePhase } from '../src/index.js';
import { fixture } from './helpers/state.js';
import type { Mutable } from './helpers/state.js';
function active(s: Mutable<GameState>, role: 'captain'|'recruiter'|'builder'|'planter'|'craftsman'|'trader') {
  s.roleCards.find(r=>r.kind===role)!.selectedBy=s.seatOrder[0]!;
  if(role==='recruiter'){const count=s.supply.workRegisterCount;s.supply.workRegisterCount=0;for(let i=0;i<count;i++)s.players[i%s.players.length]!.idleWorkerCount++;}
  const turn={actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};
  const phase: GamePhase = role==='captain' ? {kind:'captain-loading',...turn,captainBonusUsed:false,consecutiveNoLoads:0}
    : role==='recruiter' ? {kind:'recruiter-placement',...turn}
    : role==='builder' ? {kind:'builder-choice',...turn}
    : role==='planter' ? {kind:'planter-choice',...turn,acquiredTileIds:[]}
    : role==='craftsman' ? {kind:'craftsman-production',...turn,chooserProducedTypes:[]}
    : {kind:'trader-choice',...turn};
  s.phase=phase as Mutable<GamePhase>;
}
it.each([3,4,5])('accepts balanced %i-player state without mutation', n=>{
  const s=fixture(n);const before=JSON.stringify(s);assertGameState(s);expect(JSON.stringify(s)).toBe(before);
});
it.each([
  (s:Mutable<GameState>)=>{s.supply.goods.corn++;},
  (s:Mutable<GameState>)=>{s.estateBag.pop();},
  (s:Mutable<GameState>)=>{s.supply.quarryCount--;},
  (s:Mutable<GameState>)=>{s.supply.buildingStock.school--;},
  (s:Mutable<GameState>)=>{s.supply.workerCount++;},
  (s:Mutable<GameState>)=>{s.supply.vpRemaining--;},
  (s:Mutable<GameState>)=>{s.players[0]!.coins=-1;},
  (s:Mutable<GameState>)=>{s.players[0]!.coins=1.5;},
  (s:Mutable<GameState>)=>{s.governorPlayerId=createId('player','missing');},
  (s:Mutable<GameState>)=>{s.seatOrder[0]=createId('player','missing');},
  (s:Mutable<GameState>)=>{s.roleCards[0]!.selectedBy=createId('player','missing');},
  (s:Mutable<GameState>)=>{s.roleSelectionIndex=3;},
  (s:Mutable<GameState>)=>{s.phase={kind:'role-selection',actorId:s.seatOrder[1]!};},
  (s:Mutable<GameState>)=>{s.phase={kind:'round-completion'};},
  (s:Mutable<GameState>)=>{s.roleCards.pop();},
  (s:Mutable<GameState>)=>{s.ships.pop();},
])('rejects broken ledger/reference/round constraint %#', mutate=>{
  const s=fixture();mutate(s);expect(()=>assertGameState(s)).toThrow();
});
it('counts cargo and Personal Ships, and permits VP overflow',()=>{
  const s=fixture();active(s,'captain');const a=s.players[0]!;
  a.buildings.push({instanceId:createId('building','wharf-1'),buildingTypeId:'wharf',occupiedSlots:1});s.supply.buildingStock.wharf--;s.supply.workerCount--;
  a.personalShip={goodType:'corn',loadedCount:2,usedThisPhase:true};
  s.ships[0]={instanceId:s.ships[0]!.instanceId,capacity:4,goodType:'corn',loadedCount:4};
  a.goods.corn=2;s.tradingHouse=['corn'];s.supply.goods.corn=1;
  a.earnedVp=77;s.supply.vpRemaining=0;s.supply.vpOverflow=2;
  s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
  assertGameState(s);s.supply.vpOverflow=1;expect(()=>assertGameState(s)).toThrow();
});
it('checks confirmed Recruiter players without restricting later new empty slots',()=>{
  const s=fixture();s.players[0]!.idleWorkerCount=1;s.supply.workerCount--;
  assertGameState(s);active(s,'recruiter');assertGameState(s); // A has not confirmed yet.
  s.phase={kind:'recruiter-placement',actorId:s.seatOrder[1]!,roleChooserId:s.seatOrder[0]!,actorIndex:1};
  expect(()=>assertGameState(s)).toThrow();
  s.players[0]!.countryside[0]!.occupied=true;s.players[0]!.idleWorkerCount--;assertGameState(s);
});
it('rejects actor/chooser and phase-local references',()=>{
  const s=fixture();active(s,'planter');
  s.phase={kind:'planter-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:1,acquiredTileIds:[]};
  expect(()=>assertGameState(s)).toThrow();
  s.phase={kind:'planter-worker',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,acquiredTileIds:[s.players[1]!.countryside[0]!.instanceId]};
  expect(()=>assertGameState(s)).toThrow();
});
function addBuilding(s:Mutable<GameState>, type:BuildingType, occupiedSlots=0) {
  s.players[0]!.buildings.push({instanceId:createId('building',`b-${s.players[0]!.buildings.length}`),buildingTypeId:type,occupiedSlots});
  s.supply.buildingStock[type]--;s.supply.workerCount-=occupiedSlots;
}
function ended():Mutable<GameState> {
  const s=fixture();active(s,'captain');s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;
  s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
  s.phase={kind:'game-over',scores:s.players.map((p,i)=>({playerId:p.playerId,earnedVp:p.earnedVp,baseBuildingVp:0,
    bonuses:{'fire-station':0,residence:0,fortress:0,'customs-house':0,'city-hall':0},
    totalVp:p.earnedVp,tieBreakCoinsAndGoods:2,rank:i===0?1:2}))};return s;
}
const corruptions:Array<[string,(s:Mutable<GameState>)=>void,string]>=[
  ['Countryside overflow',s=>{s.players[0]!.countryside.push(...s.estateBag.splice(0,12).map(t=>({...t,occupied:false})));},'INVARIANT-002'],
  ['City overflow',s=>{for(const type of ['small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill','large-tobacco-storage','large-coffee-roaster','small-market','hacienda','builders-yard','small-warehouse','hospital','residence'] as const) addBuilding(s,type);},'INVARIANT-002'],
  ['duplicate building type',s=>{addBuilding(s,'small-market');addBuilding(s,'small-market');},'BUILDER-001'],
  ['overfilled worker slots',s=>{addBuilding(s,'small-market',2);},'ROLE-002'],
  ['overfilled ship',s=>{active(s,'captain');s.ships[0]={...s.ships[0]!,goodType:'corn',loadedCount:5};s.supply.goods.corn-=5;},'CAPTAIN-002'],
  ['duplicate cargo types',s=>{active(s,'captain');for(let i=0;i<2;i++)s.ships[i]={...s.ships[i]!,goodType:'corn',loadedCount:1};s.supply.goods.corn-=2;},'CAPTAIN-002'],
  ['House capacity',s=>{s.tradingHouse=Array.from({length:5},()=> 'corn');s.supply.goods.corn-=5;},'TRADER-001'],
  ['missing Personal Ship',s=>{addBuilding(s,'wharf');},'CAPTAIN-004'],
  ['unowned Personal Ship',s=>{s.players[0]!.personalShip={goodType:null,loadedCount:0,usedThisPhase:false};},'CAPTAIN-004'],
  ['personal cargo outside Captain',s=>{addBuilding(s,'wharf',1);s.players[0]!.personalShip={goodType:'corn',loadedCount:1,usedThisPhase:true};s.supply.goods.corn--;},'CAPTAIN-004'],
  ['completed no-load traversal',s=>{active(s,'captain');if(s.phase.kind==='captain-loading')s.phase.consecutiveNoLoads=3;},'CAPTAIN-005'],
  ['wrong role card',s=>{active(s,'captain');s.phase={kind:'builder-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};},'ROLE-001'],
  ['chooser-only bonus',s=>{active(s,'craftsman');s.phase={kind:'craftsman-bonus',actorId:s.seatOrder[1]!,roleChooserId:s.seatOrder[0]!,actorIndex:1,chooserProducedTypes:[]};},'ROLE-001'],
  ['duplicate production types',s=>{active(s,'craftsman');if(s.phase.kind==='craftsman-production')s.phase.chooserProducedTypes=['corn','corn'];},'CRAFTSMAN-002'],
  ['duplicate acquired IDs',s=>{active(s,'planter');if(s.phase.kind==='planter-choice')s.phase.acquiredTileIds=[s.players[0]!.countryside[0]!.instanceId,s.players[0]!.countryside[0]!.instanceId];},'PLANTER-002'],
  ['overflow before exhaustion',s=>{s.players[0]!.earnedVp=3;s.supply.vpRemaining=73;s.supply.vpOverflow=1;},'INVARIANT-003'],
  ['market overflow',s=>{s.estateMarket.push(s.estateBag.pop()!);},'PLANTER-003'],
  ['future trigger',s=>{active(s,'captain');s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:2,completion:'phase-completion'}];},'ENDGAME-001'],
];
it.each(corruptions)('rejects %s with its rule ID',(_name,mutate,rule)=>{const s=fixture();mutate(s);expect(()=>assertGameState(s)).toThrow(rule);});
it('accepts terminal scores separately from the finite VP ledger',()=>{
  const s=ended();assertGameState(s);const prior=s.supply.vpRemaining;
  if(s.phase.kind==='game-over' && s.phase.scores!==null){s.phase.scores[0]!.baseBuildingVp=4;s.phase.scores[0]!.totalVp+=4;}
  // Exact scoring formulas/owned-building points are PR-033; aggregate consistency only.
  assertGameState(s);expect(s.supply.vpRemaining).toBe(prior);
});
it('rejects terminal full cargo before cleanup and mismatched trigger role',()=>{
  const s=ended();s.ships[0]={...s.ships[0]!,goodType:'corn',loadedCount:4};s.supply.goods.corn-=4;
  expect(()=>assertGameState(s)).toThrow('CAPTAIN-007');
  const wrong=ended();wrong.roleCards.find(r=>r.kind==='captain')!.selectedBy=null;wrong.roleCards.find(r=>r.kind==='builder')!.selectedBy=wrong.seatOrder[0]!;
  expect(()=>assertGameState(wrong)).toThrow('ENDGAME-002');
});
it('rejects false Recruiter shortage with enough Register workers',()=>{
  const s=fixture();active(s,'recruiter');s.phase={kind:'phase-completion',role:'recruiter',roleChooserId:s.seatOrder[0]!};
  s.supply.workRegisterCount=3;for(const p of s.players)p.idleWorkerCount=0;
  s.players[0]!.idleWorkerCount=52;s.players[0]!.countryside[0]!.occupied=true;
  s.players[1]!.countryside[0]!.occupied=true;s.players[2]!.countryside[0]!.occupied=true;s.supply.workerCount=0;
  s.endTriggers=[{reason:'worker-shortage',role:'recruiter',triggeringRevision:1,completion:'phase-completion'}];
  expect(()=>assertGameState(s)).toThrow('ENDGAME-001');
  s.supply.workRegisterCount=2;s.players[0]!.idleWorkerCount++;assertGameState(s);
});
it('rejects malformed terminal scoring membership and totals',()=>{
  const s=ended();if(s.phase.kind==='game-over' && s.phase.scores!==null)s.phase.scores[0]!.totalVp++;
  expect(()=>assertGameState(s)).toThrow('SCORE-001');
  const duplicate=ended();if(duplicate.phase.kind==='game-over' && duplicate.phase.scores!==null)duplicate.phase.scores[1]!.playerId=duplicate.seatOrder[0]!;
  expect(()=>assertGameState(duplicate)).toThrow('SCORE-001');
});

it('rejects undistributed Register workers during placement',()=>{const s=fixture();active(s,'recruiter');s.players[0]!.idleWorkerCount--;s.supply.workRegisterCount++;expect(()=>assertGameState(s)).toThrow('RECRUITER-001');});
it('accepts City12 only with the matching Builder trigger, and Countryside12 without an ending',()=>{
  const city=fixture();active(city,'builder');
  for(const type of ['small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill','large-tobacco-storage','large-coffee-roaster','small-market','hacienda','builders-yard','small-warehouse','residence'] as const)addBuilding(city,type);
  expect(()=>assertGameState(city)).toThrow('ENDGAME-001');
  city.endTriggers=[{reason:'city-full',role:'builder',playerId:city.seatOrder[0]!,triggeringRevision:1,completion:'phase-completion'}];assertGameState(city);
  const country=fixture();country.players[0]!.countryside.push(...country.estateBag.splice(0,11).map(t=>({...t,occupied:false})));assertGameState(country);
});
it.each([3,4,5])('accepts final-role cleanup and next round for %i players',n=>{
  const s=fixture(n);s.roleSelectionIndex=n-1;
  for(let i=0;i<n;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i]!;
  s.phase={kind:'round-completion'};assertGameState(s);
  s.roleSelectionIndex=0;s.roundNumber++;s.governorPlayerId=s.seatOrder[1]!;
  for(const role of s.roleCards)role.selectedBy=null;
  s.phase={kind:'role-selection',actorId:s.seatOrder[1]!};assertGameState(s);
});
