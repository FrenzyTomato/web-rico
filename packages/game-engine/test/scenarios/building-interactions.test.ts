import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,serializeGame,deserializeGame } from '../../src/index.js';
import type { GameState,GameCommand,BuildingType,Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
const zero={corn:0,fruit:0,sugar:0,tobacco:0,coffee:0};
function own(s:ReturnType<typeof fixture>,type:BuildingType){s.players[0]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:1});s.supply.buildingStock[type]--;s.supply.workerCount--;if(type==='wharf')s.players[0]!.personalShip={goodType:null,loadedCount:0,usedThisPhase:false};}
function give(s:ReturnType<typeof fixture>,good:Good,n:number){s.players[0]!.goods[good]+=n;s.supply.goods[good]-=n;}
function step(state:GameState,command:GameCommand){
 const before=serializeGame(state),restored=deserializeGame(before);const result=applyCommand(restored,command);if(!result.ok)throw Error(result.error.message);
 assertGameState(result.state);expect(serializeGame(restored)).toBe(before);expect(result.state.revision).toBe(state.revision+1);
 expect(result.events.map(e=>[e.revision,e.index])).toEqual(result.events.map((_,index)=>[result.state.revision,index]));
 expect(applyCommand(deserializeGame(before),command)).toEqual(result);return result.state;
}
it('Hacienda + Hospital + occupied processing: new Coffee estate produces next role',()=>{
 const s=fixture();own(s,'hacienda');own(s,'hospital');own(s,'large-coffee-roaster');
 // Controlled hidden first Coffee; seeded bag itself is not exposed in a player command.
 const index=s.estateBag.findIndex(t=>t.kind==='coffee');const coffee=s.estateBag.splice(index,1)[0]!;s.estateBag.unshift(coffee);
 let state:GameState=step(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[0]!.instanceId});
 state=step(state,{kind:'use-hacienda',actorId:s.seatOrder[0]!,accept:true});
 state=step(state,{kind:'plant',actorId:s.seatOrder[0]!,choice:{kind:'quarry'}});
 state=step(state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId:coffee.instanceId});
 for(const actorId of s.seatOrder.slice(1))state=step(state,{kind:'plant',actorId,choice:{kind:'decline'}});
 state=step(state,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:s.roleCards[3]!.instanceId});
 expect(state.phase).toMatchObject({kind:'craftsman-production',actorId:s.seatOrder[0]});
 state=step(state,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:true,useFactory:false}});
 expect(state.players[0]!.goods.coffee).toBe(1);expect(state.players[0]!.countryside.filter(t=>t.occupied).map(t=>t.instanceId)).toEqual([coffee.instanceId]);
 expect(state.players[0]!.countryside.find(t=>t.kind==='quarry')!.occupied).toBe(false);
});
it('Office + both markets + Trader privilege compose on an existing House type',()=>{
 const s=fixture();for(const type of ['office','small-market','large-market'] as const)own(s,type);give(s,'coffee',1);s.tradingHouse=['coffee'];s.supply.goods.coffee--;
 let state=step(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[4]!.instanceId});
 state=step(state,{kind:'trade',actorId:s.seatOrder[0]!,sale:{good:'coffee',useAdvantage:true,useSmallMarket:true,useLargeMarket:true}});
 expect(state.players[0]!.coins).toBe(10);expect(state.tradingHouse).toEqual(['coffee','coffee']);expect(state.players[0]!.goods.coffee).toBe(0);
});
it('both Warehouses retain three types plus one crate, then retained goods can trade',()=>{
 const s=fixture();own(s,'small-warehouse');own(s,'large-warehouse');give(s,'corn',2);give(s,'fruit',3);give(s,'sugar',4);give(s,'tobacco',2);
 s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'captain-retention',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};
 let state=step(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:2,fruit:3,sugar:4,tobacco:1},warehouseTypes:['corn','fruit','sugar']});
 expect(state.players[0]!.goods).toEqual({...zero,corn:2,fruit:3,sugar:4,tobacco:1});expect(state.supply.goods.tobacco).toBe(8);
 state=step(state,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:s.roleCards[4]!.instanceId});
 state=step(state,{kind:'trade',actorId:s.seatOrder[0]!,sale:{good:'tobacco',useAdvantage:false,useSmallMarket:false,useLargeMarket:false}});expect(state.players[0]!.coins).toBe(5);
});
it('Harbor + Wharf + Captain bonus + Warehouses survive snapshot restoration through cleanup',()=>{
 const s=fixture();for(const type of ['harbor','wharf','small-warehouse','large-warehouse'] as const)own(s,type);
 give(s,'corn',5);give(s,'fruit',3);give(s,'sugar',4);give(s,'tobacco',2);
 for(const [index,good,count] of [[0,'corn',2],[1,'fruit',5],[2,'sugar',6]] as const){s.ships[index]={...s.ships[index]!,goodType:good,loadedCount:count};s.supply.goods[good]-=count;}
 let state=step(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[5]!.instanceId});
 state=step(state,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:true});
 state=step(state,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn'},useHarbor:true});
 expect(state.players[0]!.earnedVp).toBe(8);expect(state.players[0]!.personalShip).toMatchObject({loadedCount:3,usedThisPhase:true});
 state=step(state,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,fruit:3,sugar:4,tobacco:2},warehouseTypes:['fruit','sugar','tobacco']});
 expect(state.players[0]!.personalShip).toEqual({goodType:null,loadedCount:0,usedThisPhase:false});expect(state.ships.every(ship=>ship.goodType===null)).toBe(true);expect(state.supply.goods.corn).toBe(10);expect(state.players[0]!.earnedVp).toBe(8);
});
