import { expect,it } from 'vitest';
import { applyCommand,assertGameState,getLegalCommands } from '../../src/index.js';
import type { GameCommand } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
const zero={corn:0,fruit:0,sugar:0,tobacco:0,coffee:0};
function setup(){const s=fixture();s.roleCards[5]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'captain-retention',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};s.players[0]!.goods={...zero,corn:2,fruit:3};s.supply.goods.corn-=2;s.supply.goods.fruit-=3;return s;}
it('CAP-06 retains one crate, discards the rest, skips empty players and completes',()=>{
 const s=setup(),before=JSON.stringify(s);expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'captain-retention',actorId:s.seatOrder[0],available:s.players[0]!.goods,maxWarehouseTypes:0,extraSingleCrates:1}]);
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:{...zero,fruit:1},warehouseTypes:[]});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.goods).toEqual({...zero,fruit:1});expect(r.state.supply.goods).toEqual({...s.supply.goods,corn:10,fruit:10});expect(r.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
 expect(r.events.slice(0,2)).toEqual(['corn','fruit'].map((good,index)=>({kind:'goods-moved',revision:2,index,good,quantity:2,from:{kind:'player',playerId:s.seatOrder[0]},to:{kind:'supply'}})));
 expect(JSON.stringify(s)).toBe(before);expect(r.events.every(e=>e.revision===2)).toBe(true);assertGameState(r.state);
});
it.each([null,{}, {...zero,corn:2},{...zero,coffee:1},{...zero,corn:-1},{...zero,fruit:0.5},{...zero,extra:1}])('rejects invalid retention %j without changes',retained=>{
 const s=setup(),before=JSON.stringify(s);expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained,warehouseTypes:[]} as unknown as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});expect(JSON.stringify(s)).toBe(before);
});
it.each([false,true])('CAP-07 unloads full ships after retention; ending=%s',ending=>{
 const s=setup();s.ships[0]={...s.ships[0]!,goodType:'corn',loadedCount:4};s.supply.goods.corn-=4;s.ships[1]={...s.ships[1]!,goodType:'fruit',loadedCount:2};s.supply.goods.fruit-=2;
 if(ending){s.players[1]!.earnedVp=75;s.supply.vpRemaining=0;s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];}
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:zero,warehouseTypes:[]});if(!r.ok)throw Error(r.error.message);
 expect(r.state.ships[0]).toMatchObject({goodType:null,loadedCount:0});expect(r.state.ships[1]).toEqual(s.ships[1]);expect(r.state.supply.goods.corn).toBe(10);expect(r.state.supply.goods.fruit).toBe(9);
 expect(r.state.phase.kind).toBe(ending?'game-over':'role-selection');expect(r.state.endTriggers).toEqual(s.endTriggers);assertGameState(r.state);
});
it('advances to the next nonempty player and forbids loading or unimplemented storage',()=>{
 const s=setup();s.players[2]!.goods.coffee=2;s.supply.goods.coffee-=2;
 expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:zero,warehouseTypes:['corn']})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:zero,warehouseTypes:[]});if(!r.ok)throw Error(r.error.message);expect(r.state.phase).toMatchObject({kind:'captain-retention',actorId:s.seatOrder[2],actorIndex:2});
 expect(applyCommand(r.state,{kind:'load',actorId:s.seatOrder[2]!,shipment:{kind:'cargo',good:'coffee',shipId:s.ships[2]!.instanceId},useHarbor:false})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
it('rejects wrong actors and exhausted revisions',()=>{
 const s=setup();expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[1]!,retained:zero,warehouseTypes:[]})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 s.revision=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);expect(applyCommand(s,{kind:'retain',actorId:s.seatOrder[0]!,retained:zero,warehouseTypes:[]})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it.each([3,4,5])('finishes last-selected Captain and rotates Governor for %i players',n=>{
 const s=fixture(n);s.roleSelectionIndex=n-1;for(let i=0;i<n-1;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i]!;s.roleCards[5]!.selectedBy=s.seatOrder[n-1]!;
 s.phase={kind:'captain-retention',actorId:s.seatOrder[n-1]!,roleChooserId:s.seatOrder[n-1]!,actorIndex:0};s.players[n-1]!.goods.corn=1;s.supply.goods.corn--;
 const r=applyCommand(s,{kind:'retain',actorId:s.seatOrder[n-1]!,retained:{...zero,corn:1},warehouseTypes:[]});if(!r.ok)throw Error(r.error.message);
 expect(r.state.roundNumber).toBe(2);expect(r.state.governorPlayerId).toBe(s.seatOrder[1]);expect(r.state.revision).toBe(2);expect(r.state.roleCards.every(c=>c.selectedBy===null)).toBe(true);assertGameState(r.state);
});
