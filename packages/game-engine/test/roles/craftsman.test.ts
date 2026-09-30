import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands } from '../../src/index.js';
import type { BuildingType, GameCommand, Good, GameState } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(){const s=fixture();s.roleCards[3]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'craftsman-production',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,chooserProducedTypes:[]};return s;}
function estate(s:ReturnType<typeof setup>,actor:number,good:Good,count:number){
 for(let i=0;i<count;i++){const at=s.estateBag.findIndex(t=>t.kind===good);const tile=s.estateBag.splice(at,1)[0]!;s.players[actor]!.countryside.push({...tile,occupied:true});s.supply.workerCount--;}
}
function building(s:ReturnType<typeof setup>,actor:number,type:BuildingType,workers:number){s.players[actor]!.buildings.push({instanceId:createId('building',`${actor}-${type}`),buildingTypeId:type,occupiedSlots:workers});s.supply.buildingStock[type]--;s.supply.workerCount-=workers;}
function produce(s:GameState,accept=true){if(!('actorId' in s.phase))throw Error('Expected actor');const r=applyCommand(s,{kind:'produce',actorId:s.phase.actorId,production:accept?{accept:true,useFactory:false}:{accept:false}});if(!r.ok)throw Error(r.error.message);assertGameState(r.state);return r;}
it('PRO-01 produces C1/F2/S0, preserving workers, RNG and input',()=>{
 const s=setup();estate(s,0,'corn',2);estate(s,0,'fruit',3);estate(s,0,'sugar',2);building(s,0,'large-fruit-depot',2);building(s,0,'small-sugar-mill',0);
 s.players[2]!.goods.corn=9;s.supply.goods.corn=1;s.players[2]!.goods.fruit=6;s.supply.goods.fruit=5;
 estate(s,1,'corn',1); // retain a real next decision
 const before=JSON.stringify(s);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'craftsman-production',actorId:s.seatOrder[0],canDecline:true,output:{corn:1,fruit:2,sugar:0,tobacco:0,coffee:0},factoryChoices:[false]}]);
 const r=produce(s);expect(r.state.players[0]!.goods).toEqual({corn:1,fruit:2,sugar:0,tobacco:0,coffee:0});
 expect(r.state.supply.goods).toEqual({...s.supply.goods,corn:0,fruit:3});expect(r.state.players[0]!.countryside).toEqual(s.players[0]!.countryside);expect(r.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);
 expect(r.events.slice(0,2)).toEqual(['corn','fruit'].map((good,index)=>({kind:'goods-moved',revision:2,index,good,quantity:index===0?1:2,from:{kind:'supply'},to:{kind:'player',playerId:s.seatOrder[0]}})));
});
it.each([
 ['small-fruit-depot','fruit',1],['small-sugar-mill','sugar',1],['large-fruit-depot','fruit',3],['large-sugar-mill','sugar',3],['large-tobacco-storage','tobacco',3],['large-coffee-roaster','coffee',2],
] as const)('%s production capacity %s %i', (type,good,capacity)=>{
 const s=setup();estate(s,0,good,4);building(s,0,type,capacity);
 expect(produce(s).state.players[0]!.goods[good]).toBe(capacity);
});
it.each([3,4,5])('PRO-02 sequential supply %i and late bonus',supply=>{
 const s=setup();for(const i of [0,1]){estate(s,i,'fruit',2);building(s,i,'large-fruit-depot',2);}
 s.players[2]!.goods.fruit=11-supply;s.supply.goods.fruit=supply;s.players[0]!.goods.coffee=1;s.supply.goods.coffee--;
 const first=produce(s);expect(first.state.players[0]!.goods.fruit).toBe(2);expect(first.state.phase.kind).toBe('craftsman-production');
 expect(applyCommand(first.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:'fruit'}).ok).toBe(false);
 const second=produce(first.state);expect(second.state.players[1]!.goods.fruit).toBe(Math.min(2,supply-2));
 expect(second.state.phase.kind).toBe(supply===5?'craftsman-bonus':'role-selection');
 if(supply===5){
  expect(getLegalCommands(second.state,s.seatOrder[0]!)).toEqual([{phase:'craftsman-bonus',actorId:s.seatOrder[0],goods:[null,'fruit']}]);
  expect(applyCommand(second.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:'coffee'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  for(const good of [null,'fruit'] as const){const r=applyCommand(second.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.goods.fruit).toBe(good?3:2);expect(r.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});expect(r.events.every(e=>e.revision===r.state.revision)).toBe(true);}
 }
});
it('decline produces nothing and does not earn a bonus from old goods',()=>{
 const s=setup();estate(s,0,'corn',1);s.players[0]!.goods.corn=1;s.supply.goods.corn--;
 const r=produce(s,false);expect(r.state.players).toEqual(s.players);expect(r.state.supply).toEqual(s.supply);expect(r.state.phase.kind).toBe('role-selection');
});
it.each([null,{}, {accept:1},{accept:true},{accept:true,useFactory:true},{accept:true,useFactory:false,fruit:1},{accept:false,goods:{fruit:1}}])('rejects invalid or partial production %j',production=>{
 const s=setup();estate(s,0,'fruit',2);building(s,0,'large-fruit-depot',2);const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});expect(JSON.stringify(s)).toBe(before);
});
it('sums matching processing slots and ignores unoccupied estates',()=>{
 const s=setup();estate(s,0,'fruit',4);building(s,0,'small-fruit-depot',1);building(s,0,'large-fruit-depot',3);
 expect(produce(s).state.players[0]!.goods.fruit).toBe(4);
 s.players[0]!.countryside[1]!.occupied=false;s.supply.workerCount++;
 expect(produce(s).state.players[0]!.goods.fruit).toBe(3);
});
it.each([3,4,5])('skips zero-output actors and finishes a round for %i players in one revision',n=>{
 const s=fixture(n);s.roleSelectionIndex=n-1;for(let i=0;i<n-1;i++)s.roleCards.filter(r=>r.kind!=='craftsman')[i]!.selectedBy=s.seatOrder[i]!;
 s.phase={kind:'role-selection',actorId:s.seatOrder[n-1]!};const before=JSON.stringify(s);
 const r=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[n-1]!,roleCardId:s.roleCards[3]!.instanceId});if(!r.ok)throw Error(r.error.message);
 expect(r.state.roundNumber).toBe(2);expect(r.state.governorPlayerId).toBe(s.seatOrder[1]);expect(r.state.revision).toBe(2);expect(r.state.players).toEqual(s.players);
 expect(r.events.map(e=>e.index)).toEqual(r.events.map((_,i)=>i));expect(r.events.every(e=>e.revision===2)).toBe(true);expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
});
it('rejects wrong actors, malformed bonuses, repeated bonus and revision overflow',()=>{
 const s=setup();estate(s,0,'corn',1);
 expect(applyCommand(s,{kind:'produce',actorId:s.seatOrder[1]!,production:{accept:true,useFactory:false}})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 const r=produce(s);expect(r.state.phase.kind).toBe('craftsman-bonus');
 for(const good of [undefined,42,{},'fruit'])expect(applyCommand(r.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const bonus=applyCommand(r.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:'corn'});if(!bonus.ok)throw Error(bonus.error.message);
 expect(applyCommand(bonus.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:'corn'}).ok).toBe(false);
 const capped={...r.state,revision:Number.MAX_SAFE_INTEGER};expect(getLegalCommands(capped,s.seatOrder[0]!)).toMatchObject([{goods:[]}]);
 expect(applyCommand(capped,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:null})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 s.revision=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);
 expect(applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:false}})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
