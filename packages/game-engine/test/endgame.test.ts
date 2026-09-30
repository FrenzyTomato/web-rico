import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands, serializeGame, deserializeGame, calculateFinalScore } from '../src/index.js';
import type { BuildingType, GameCommand, GameState } from '../src/index.js';
import { fixture } from './helpers/state.js';

function step(state:GameState, command:GameCommand) {
 const before=serializeGame(state);
 const result=applyCommand(deserializeGame(before),command);
 if(!result.ok)throw Error(result.error.message);
 expect(serializeGame(state)).toBe(before);assertGameState(result.state);
 expect(result.state.revision).toBe(state.revision+1);
 expect(result.events.map(e=>e.index)).toEqual(result.events.map((_,i)=>i));
 expect(result.events.every(e=>e.revision===result.state.revision)).toBe(true);
 expect(applyCommand(deserializeGame(before),command)).toEqual(result);
 return result;
}
function terminal(state:GameState, initial:GameState) {
 expect(state.phase).toEqual({kind:'game-over',scores:calculateFinalScore(state)});
 expect(state.roundNumber).toBe(initial.roundNumber);
 expect(state.governorPlayerId).toBe(initial.governorPlayerId);
 expect(state.roleSelectionIndex).toBe(initial.roleSelectionIndex);
 expect(state.roleCards).toEqual(initial.roleCards);
 expect(state.rng).toEqual(initial.rng);
 expect(deserializeGame(serializeGame(state))).toEqual(state);
 for(const actorId of state.seatOrder){
  expect(getLegalCommands(state,actorId)).toEqual([]);
  for(const kind of ['choose-role','use-hacienda','plant','use-hospital','recruit-worker','allocate-workers','build','produce','take-production-bonus','trade','load','decline-wharf','retain','take-adventurer-coin']){
   const before=serializeGame(state);
   expect(applyCommand(state,{kind,actorId} as GameCommand)).toMatchObject({ok:false,error:{code:'GAME_OVER'}});
   expect(serializeGame(state)).toBe(before);
  }
 }
}
const cityTypes:BuildingType[]=['small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill','large-tobacco-storage','large-coffee-roaster','small-market','hacienda','builders-yard','small-warehouse','hospital'];
it.each([3,4,5].flatMap(n=>[false,true].map(last=>({n,last}))))('END-01/02: two full Cities with $n actors, final role=$last',({n,last})=>{
 const s=fixture(n);
 if(last){s.roleSelectionIndex=n-1;s.governorPlayerId=s.seatOrder[1]!;
  for(let i=0;i<n-1;i++)s.roleCards.filter(c=>c.kind!=='builder')[i]!.selectedBy=s.seatOrder[i+1]!;
 }
 s.roleCards[2]!.selectedBy=s.seatOrder[0]!;
 s.phase={kind:'builder-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};
 for(let i=0;i<2;i++){
  s.players[i]!.coins=10;
  for(const type of cityTypes){s.players[i]!.buildings.push({instanceId:createId('building',`${i}-${type}`),buildingTypeId:type,occupiedSlots:0});s.supply.buildingStock[type]--;}
 }
 assertGameState(s);
 let state:GameState=s;
 for(let i=0;i<n;i++){
  const result=step(state,{kind:'build',actorId:s.seatOrder[i]!,purchase:i<2?{buildingTypeId:'office',useAdvantage:false,useSchool:false}:null});
  state=result.state;
  if(i<n-1)expect(state.phase.kind).toBe('builder-choice');
  if(i===n-1)expect(result.events.at(-2)).toMatchObject({kind:'phase-changed',from:'phase-completion',to:'game-over'});
 }
 expect(state.endTriggers).toEqual([0,1].map(i=>({reason:'city-full',role:'builder',playerId:s.seatOrder[i],triggeringRevision:i+2,completion:'phase-completion'})));
 terminal(state,s);
});
it.each([3,4,5])('END-02: Recruiter shortage finishes the refill for %i players',n=>{
 const s=fixture(n);s.roleCards[1]!.selectedBy=s.seatOrder[0]!;
 s.phase={kind:'recruiter-placement',actorId:s.seatOrder[n-1]!,roleChooserId:s.seatOrder[0]!,actorIndex:n-1};
 const total=n===3?58:n===4?79:100;
 s.supply.workRegisterCount=0;s.supply.workerCount=n-1;
 s.players[0]!.countryside[0]!.occupied=true;s.players[0]!.idleWorkerCount=total-n;
 const p=s.players[n-1]!;assertGameState(s);
 const r=step(s,{kind:'allocate-workers',actorId:p.playerId,allocation:{countryside:p.countryside.map(t=>({tileId:t.instanceId,occupied:false})),buildings:[],idleCount:0}});
 expect(r.state.supply.workerCount).toBe(0);expect(r.state.supply.workRegisterCount).toBe(n-1);
 expect(r.state.endTriggers).toEqual([{reason:'worker-shortage',role:'recruiter',triggeringRevision:2,completion:'phase-completion'}]);
 terminal(r.state,s);
});
it('END-02: VP exhaustion still permits loading, overflow, retention and ship cleanup',()=>{
 const s=fixture();s.roleCards[5]!.selectedBy=s.seatOrder[0]!;
 s.phase={kind:'captain-loading',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:0};
 s.supply.vpRemaining=1;s.players[2]!.earnedVp=74;
 s.players[0]!.goods.corn=4;s.supply.goods.corn-=4;
 s.players[1]!.goods.corn=2;s.supply.goods.corn-=2;
 s.players[1]!.goods.fruit=2;s.supply.goods.fruit-=2;
 const a=step(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:false});
 expect(a.state.phase).toMatchObject({kind:'captain-loading',actorId:s.seatOrder[1]});
 const b=step(a.state,{kind:'load',actorId:s.seatOrder[1]!,shipment:{kind:'cargo',good:'fruit',shipId:s.ships[1]!.instanceId},useHarbor:false});
 expect(b.state.phase).toMatchObject({kind:'captain-retention',actorId:s.seatOrder[1]});
 const c=step(b.state,{kind:'retain',actorId:s.seatOrder[1]!,retained:{corn:1,fruit:0,sugar:0,tobacco:0,coffee:0},warehouseTypes:[]});
 expect(c.state.supply.vpOverflow).toBe(6);
 expect(c.state.ships[0]!.loadedCount).toBe(0);expect(c.state.ships[1]!.loadedCount).toBe(2);
 expect(c.state.players[1]!.goods.corn).toBe(1);
 expect(c.state.endTriggers).toEqual(a.state.endTriggers);
 expect(c.events.at(-2)).toMatchObject({kind:'phase-changed',to:'game-over'});
 terminal(c.state,s);
});

it('END-01: empty goods, Quarry and estate supplies do not end a role',()=>{
 const s=fixture();s.roleCards[2]!.selectedBy=s.seatOrder[0]!;
 s.phase={kind:'builder-choice',actorId:s.seatOrder[2]!,roleChooserId:s.seatOrder[0]!,actorIndex:2};
 for(const good of ['corn','fruit','sugar','tobacco','coffee'] as const){s.players[0]!.goods[good]=s.supply.goods[good];s.supply.goods[good]=0;}
 s.estateDiscard.push(...s.estateBag,...s.estateMarket);s.estateBag=[];s.estateMarket=[];
 for(let i=0;i<8;i++)s.players[0]!.countryside.push({instanceId:createId('tile',`quarry-${i}`),kind:'quarry',occupied:false});
 s.supply.quarryCount=0;assertGameState(s);
 const r=step(s,{kind:'build',actorId:s.seatOrder[2]!,purchase:null});
 expect(r.state.endTriggers).toEqual([]);expect(r.state.phase.kind).toBe('role-selection');
});
