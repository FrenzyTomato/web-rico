import { expect,it } from 'vitest';
import { calculateFinalScore } from '../src/scoring/calculateFinalScore.js';
import { applyCommand,assertGameState,createId,serializeGame,deserializeGame } from '../src/index.js';
import type { BuildingType } from '../src/index.js';
import { fixture } from './helpers/state.js';
function own(s:ReturnType<typeof fixture>,type:BuildingType,occupied=1){
 s.players[0]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:occupied});
 s.supply.buildingStock[type]--;s.supply.workerCount-=occupied;
}
function freeze(value:unknown):void {if(value && typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}}
it('SCR-01: 30 earned + 11 base + 7 Customs + 3 City Hall = 51, pure and itemized',()=>{
 const s=fixture();own(s,'customs-house');own(s,'city-hall');own(s,'small-market',0);own(s,'large-fruit-depot',0);
 s.players[0]!.earnedVp=30;s.supply.vpRemaining=45;assertGameState(s);
 const before=serializeGame(s);freeze(s);
 const scores=calculateFinalScore(s);
 expect(scores[0]).toEqual({playerId:s.seatOrder[0],earnedVp:30,baseBuildingVp:11,
  bonuses:{'fire-station':0,residence:0,fortress:0,'customs-house':7,'city-hall':3},
  totalVp:51,tieBreakCoinsAndGoods:2,rank:1});
 expect(calculateFinalScore(s)).toEqual(scores);expect(serializeGame(s)).toBe(before);
 expect(scores[1]!.rank).toBe(2);expect(scores[2]!.rank).toBe(2);
});
it.each([false,true])('SCR-02: 40 VP beats 39; coins plus goods resolve or share rank, tied=%s',tied=>{
 const s=fixture();s.players.forEach((p,i)=>{p.earnedVp=[40,40,39][i]!;p.coins=i===2?100:3;});
 s.players[0]!.goods.corn=2;s.players[1]!.goods.corn=tied?2:1;s.supply.goods.corn-=tied?4:3;
 s.supply.vpRemaining=0;s.supply.vpOverflow=44;
 s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'phase-completion',role:'captain',roleChooserId:s.seatOrder[0]!};
 s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];assertGameState(s);
 const scores=calculateFinalScore(s);
 expect(scores.map(x=>x.totalVp)).toEqual([40,40,39]);
 expect(scores.map(x=>x.tieBreakCoinsAndGoods)).toEqual([5,tied?5:4,100]);
 expect(scores.map(x=>x.rank)).toEqual([1,tied?1:2,3]);
 // Return breakdowns in seat order, regardless of the players array order.
 expect(calculateFinalScore({...s,players:[...s.players].reverse()})).toEqual(scores);
});
it('composes all five bonuses once, with base points even for unoccupied buildings',()=>{
 const s=fixture();for(const type of ['fire-station','residence','fortress','customs-house','city-hall'] as const)own(s,type);
 own(s,'small-fruit-depot',0);own(s,'small-sugar-mill',0);
 for(let i=0;i<11;i++){const tile=s.estateBag.pop()!;s.players[0]!.countryside.push({...tile,occupied:false});}
 s.players[0]!.idleWorkerCount=4;s.supply.workerCount-=4;s.players[0]!.earnedVp=30;s.supply.vpRemaining=45;
 s.roleCards[2]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'phase-completion',role:'builder',roleChooserId:s.seatOrder[0]!};
 s.endTriggers=[{reason:'city-full',role:'builder',playerId:s.seatOrder[0]!,triggeringRevision:1,completion:'phase-completion'}];assertGameState(s);
 expect(calculateFinalScore(s)[0]).toMatchObject({baseBuildingVp:22,
  bonuses:{'fire-station':2,residence:7,fortress:3,'customs-house':7,'city-hall':5},totalVp:76});
});
it.each([3,4,5])('scores immediately at Recruiter completion for %i players and emits one ordered scoring event',n=>{
 const s=fixture(n);s.roleCards[1]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'recruiter-placement',actorId:s.seatOrder[n-1]!,roleChooserId:s.seatOrder[0]!,actorIndex:n-1};
 const total=n===3?58:n===4?79:100;s.supply.workerCount=0;s.supply.workRegisterCount=0;
 s.players[0]!.countryside[0]!.occupied=true;s.players[0]!.idleWorkerCount=total-1;
 const p=s.players[n-1]!;assertGameState(s);freeze(s);
 const r=applyCommand(s,{kind:'allocate-workers',actorId:p.playerId,allocation:{countryside:p.countryside.map(t=>({tileId:t.instanceId,occupied:false})),buildings:[],idleCount:0}});
 if(!r.ok)throw Error(r.error.message);
 expect(r.state.phase).toEqual({kind:'game-over',scores:calculateFinalScore(r.state)});
 expect(r.events.filter(e=>e.kind==='game-scored')).toEqual([{kind:'game-scored',revision:2,index:r.events.length-1,scores:calculateFinalScore(r.state)}]);
 expect(r.events.at(-2)).toMatchObject({kind:'phase-changed',to:'game-over'});
 expect(r.events.map(e=>e.index)).toEqual(r.events.map((_,i)=>i));
 assertGameState(r.state);expect(deserializeGame(serializeGame(r.state))).toEqual(r.state);
});
it('rejects score fields exceeding safe integer storage',()=>{
 const s=fixture();s.players[0]!.coins=Number.MAX_SAFE_INTEGER;s.players[0]!.goods.corn=1;s.supply.goods.corn--;
 expect(()=>calculateFinalScore(s)).toThrow('SCORE-002');
});

it('terminal snapshots require completed score arrays',()=>{
 const s=fixture();s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'phase-completion',role:'captain',roleChooserId:s.seatOrder[0]!};
 s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
 const snapshot=JSON.parse(serializeGame(s));snapshot.phase={kind:'game-over',scores:null};
 expect(()=>deserializeGame(JSON.stringify(snapshot))).toThrow('INVALID_SNAPSHOT');
});

it('Captain scoring counts overflow in Customs House but excludes unloaded ship cargo from tiebreak',()=>{
 const s=fixture();own(s,'customs-house');s.players[0]!.earnedVp=25;s.players[1]!.earnedVp=48;s.supply.vpRemaining=2;
 s.players[0]!.goods.corn=4;s.supply.goods.corn-=4;
 s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'captain-loading',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:0};assertGameState(s);
 const before=serializeGame(s);freeze(s);
 const r=applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:false});
 if(!r.ok)throw Error(r.error.message);
 expect(r.state.supply.vpOverflow).toBe(3);expect(r.state.ships[0]!.loadedCount).toBe(0);
 expect(r.state.phase.kind).toBe('game-over');
 if(r.state.phase.kind!=='game-over')throw Error('not terminal');
 expect(r.state.phase.scores[0]).toMatchObject({earnedVp:30,baseBuildingVp:4,bonuses:{'customs-house':7},totalVp:41,tieBreakCoinsAndGoods:2});
 expect(serializeGame(s)).toBe(before);
 expect(r.events.at(-1)).toMatchObject({kind:'game-scored',scores:r.state.phase.scores});
});
