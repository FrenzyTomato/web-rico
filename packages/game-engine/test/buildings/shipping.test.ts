import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,getLegalCommands } from '../../src/index.js';
import type { BuildingType,GameCommand,Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
const zero={corn:0,fruit:0,sugar:0,tobacco:0,coffee:0};
function setup(){const s=fixture();s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'captain-retention',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};return s;}
function add(s:ReturnType<typeof setup>,type:BuildingType,active=true){s.players[0]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:Number(active)});s.supply.buildingStock[type]--;s.supply.workerCount-=Number(active);if(type==='wharf')s.players[0]!.personalShip={goodType:null,loadedCount:0,usedThisPhase:false};}
function inventory(s:ReturnType<typeof setup>,stock:Partial<Record<Good,number>>){for(const [good,count] of Object.entries(stock) as [Good,number][]){s.players[0]!.goods[good]+=count;s.supply.goods[good]-=count;}}
it.each([
 {types:['small-warehouse'],protect:['sugar'],keep:{fruit:1,sugar:4},total:5},
 {types:['large-warehouse'],protect:['fruit','sugar'],keep:{corn:1,fruit:3,sugar:4},total:8},
 {types:['small-warehouse','large-warehouse'],protect:['corn','fruit','sugar'],keep:{corn:2,fruit:3,sugar:4,tobacco:1},total:10},
])('Warehouses $types protect $total crates',({types,protect,keep,total})=>{
 const s=setup();for(const type of types)add(s,type as BuildingType);inventory(s,{corn:2,fruit:3,sugar:4,tobacco:types.length===2 || types[0]==='large-warehouse'?2:0});const before=JSON.stringify(s);
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,...keep},warehouseTypes:protect as Good[]});if(!r.ok)throw Error(r.error.message);expect(Object.values(r.state.players[0]!.goods).reduce((a,b)=>a+b,0)).toBe(total);expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
});
it.each([['corn','corn'],['corn','fruit'],['unknown'],new Array(1)])('rejects invalid protected types %j',warehouseTypes=>{
 const s=setup();add(s,'small-warehouse');inventory(s,{corn:2,fruit:3});expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:2},warehouseTypes} as unknown as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it('inactive or declined Warehouses give only one crate; excess outside protection rejects',()=>{
 const s=setup();add(s,'large-warehouse',false);inventory(s,{corn:2,fruit:3});expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{maxWarehouseTypes:0}]);
 expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:2},warehouseTypes:['corn']})).toMatchObject({ok:false});
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:1},warehouseTypes:[]});expect(r.ok).toBe(true);
 s.players[0]!.buildings[0]!.occupiedSlots=1;s.supply.workerCount--;expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:2,fruit:2},warehouseTypes:['corn']})).toMatchObject({ok:false});
});
function shipping(active=true){const s=setup();s.phase={kind:'captain-loading',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:0};add(s,'wharf',active);add(s,'harbor',active);s.ships[0]={...s.ships[0]!,goodType:'corn',loadedCount:2};s.ships[1]={...s.ships[1]!,goodType:'fruit',loadedCount:5};s.ships[2]={...s.ships[2]!,goodType:'coffee',loadedCount:6};s.supply.goods.corn-=2;s.supply.goods.fruit-=5;s.supply.goods.coffee-=6;inventory(s,{corn:5});s.players[1]!.goods.sugar=1;s.supply.goods.sugar--;return s;}
it.each([false,true])('Harbor+Wharf: Corn2 then personal Corn3, Harbor=%s',useHarbor=>{
 const s=shipping(),before=JSON.stringify(s);
 const first=applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor});if(!first.ok)throw Error(first.error.message);
 expect(first.state.players[0]!.earnedVp).toBe(useHarbor?4:3);
 expect(getLegalCommands(first.state,s.seatOrder[0]!)).toMatchObject([{loads:[{shipment:{kind:'personal',good:'corn'},quantity:3}],harborChoices:[false,true],canDeclineWharf:true}]);
 const second=applyCommand(first.state,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn'},useHarbor});if(!second.ok)throw Error(second.error.message);
 expect(second.state.players[0]!.earnedVp).toBe(useHarbor?8:6);expect(second.state.players[0]!.personalShip).toEqual({goodType:'corn',loadedCount:3,usedThisPhase:true});expect(second.state.supply.goods.corn).toBe(s.supply.goods.corn);expect(second.state.phase).toMatchObject({kind:'captain-retention',actorId:s.seatOrder[1]});
 const done=applyCommand(second.state,{kind:'retain',actorId:s.seatOrder[1]!,retained:{...zero,sugar:1},warehouseTypes:[]});if(!done.ok)throw Error(done.error.message);expect(done.state.players[0]!.personalShip).toEqual({goodType:null,loadedCount:0,usedThisPhase:false});expect(done.state.supply.goods.corn).toBe(10);expect(done.state.ships.every(ship=>ship.goodType===null)).toBe(true);expect(JSON.stringify(s)).toBe(before);assertGameState(done.state);
});
it('Wharf can replace mandatory cargo, but declining cannot pass it; rejects partial/second charter',()=>{
 const s=shipping();expect(applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!})).toMatchObject({ok:false});
 expect(applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn',quantity:4},useHarbor:false} as unknown as GameCommand)).toMatchObject({ok:false});
 // Another owned type remains blocked, so retention waits with the used Personal Ship intact.
 inventory(s,{fruit:1});const r=applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn'},useHarbor:false});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.personalShip).toMatchObject({loadedCount:5,usedThisPhase:true});expect(r.state.ships[0]).toEqual(s.ships[0]);
 const replay={...r.state,phase:s.phase};expect(applyCommand(replay,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'fruit'},useHarbor:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it('inactive Harbor/Wharf reject, but ordinary cargo remains available',()=>{
 const s=shipping(false);expect(applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn'},useHarbor:false})).toMatchObject({ok:false});
 expect(applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:true})).toMatchObject({ok:false});
 expect(applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:false}).ok).toBe(true);
});
it('B-18 nonchooser charters Coffee5, held through retention and returned once on cleanup',()=>{
 const s=setup();add(s,'wharf');s.governorPlayerId=s.seatOrder[2]!;s.roleCards[5]!.selectedBy=s.seatOrder[2]!;s.phase={kind:'captain-loading',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[2]!,actorIndex:1,captainBonusUsed:false,consecutiveNoLoads:0};
 s.ships[0]={...s.ships[0]!,goodType:'coffee',loadedCount:4};s.supply.goods.coffee-=4;inventory(s,{coffee:5,corn:1});s.ships[1]={...s.ships[1]!,goodType:'corn',loadedCount:5};s.supply.goods.corn-=5;
 const r=applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'coffee'},useHarbor:false});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.earnedVp).toBe(5);expect(r.state.players[0]!.personalShip).toMatchObject({goodType:'coffee',loadedCount:5,usedThisPhase:true});expect(r.state.supply.goods.coffee).toBe(0);
 const done=applyCommand(r.state,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:1},warehouseTypes:[]});if(!done.ok)throw Error(done.error.message);expect(done.state.supply.goods.coffee).toBe(9);expect(done.events.filter(e=>e.kind==='goods-moved' && e.from.kind==='personal-ship')).toHaveLength(1);assertGameState(done.state);
});
it('Harbor personal award overflows VP supply and preserves completion timing',()=>{
 const s=shipping();s.players[2]!.earnedVp=73;s.supply.vpRemaining=2;
 const r=applyCommand(s,{kind:'load',actorId:s.seatOrder[0]!,shipment:{kind:'personal',good:'corn'},useHarbor:true});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.earnedVp).toBe(7);expect(r.state.supply.vpOverflow).toBe(5);expect(r.state.endTriggers).toHaveLength(1);expect(r.state.phase.kind).toBe('captain-retention');assertGameState(r.state);
});
it('Warehouses cannot excuse mandatory loading and empty inventory skips retention',()=>{
 const s=shipping();add(s,'large-warehouse');expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,corn:5},warehouseTypes:['corn']})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
 const empty=setup();add(empty,'small-warehouse');const r=applyCommand(empty,{kind:'retain',actorId:empty.seatOrder[0]!,retained:zero,warehouseTypes:[]});expect(r.ok).toBe(true);
});
