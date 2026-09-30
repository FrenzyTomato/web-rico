import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,getLegalCommands } from '../../src/index.js';
import type { BuildingType,Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function add(s:ReturnType<typeof fixture>,type:BuildingType,occupied=1){s.players[0]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:occupied});s.supply.buildingStock[type]--;s.supply.workerCount-=occupied;}
it.each([false,true])('markets: independent optional bonuses, occupied=%s',active=>{
 const s=fixture();add(s,'small-market',Number(active));add(s,'large-market',Number(active));s.roleCards[4]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'trader-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};s.players[0]!.goods.coffee=1;s.supply.goods.coffee--;
 for(const useSmallMarket of [false,true])for(const useLargeMarket of [false,true])for(const useAdvantage of [false,true]){
  const before=JSON.stringify(s),sale={good:'coffee' as const,useSmallMarket,useLargeMarket,useAdvantage};
  const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale});
  if(!active && (useSmallMarket || useLargeMarket))expect(r).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  else {if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.coins).toBe(2+4+Number(useAdvantage)+Number(useSmallMarket)+2*Number(useLargeMarket));assertGameState(r.state);}
  expect(JSON.stringify(s)).toBe(before);
 }
});
it('Small Market grants1 for nonchooser Corn and descriptors exclude overflowing combinations',()=>{
 const s=fixture();add(s,'small-market');s.governorPlayerId=s.seatOrder[2]!;s.roleCards[4]!.selectedBy=s.seatOrder[2]!;s.phase={kind:'trader-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[2]!,actorIndex:1};s.players[0]!.goods.corn=1;s.supply.goods.corn--;
 const sale={good:'corn' as const,useAdvantage:false,useSmallMarket:true,useLargeMarket:false};const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.coins).toBe(3);
 s.players[0]!.coins=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{sales:[{...sale,useSmallMarket:false,price:0}]}]);expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale})).toMatchObject({ok:false});
});
function production(types:number,active=true){
 const s=fixture();add(s,'factory',Number(active));s.roleCards[3]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'craftsman-production',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,chooserProducedTypes:[]};
 const goods:Good[]=['corn','fruit','sugar','tobacco','coffee'];const processors:BuildingType[]=['small-fruit-depot','small-sugar-mill','large-tobacco-storage','large-coffee-roaster'];
 for(let i=0;i<types;i++){const at=s.estateBag.findIndex(t=>t.kind===goods[i]);s.players[0]!.countryside.push({...s.estateBag.splice(at,1)[0]!,occupied:true});s.supply.workerCount--;if(i>0)add(s,processors[i-1]!);}
 return s;
}
it.each([0,1,2,3,4,5])('Factory counts %i actual types, pays only if active and accepted',types=>{
 for(const active of [false,true])for(const useFactory of [false,true]){
  const s=production(types,active),before=JSON.stringify(s);const r=applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:true,useFactory}});
  if(useFactory && !active)expect(r).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  else {if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.coins).toBe(2+(useFactory?[0,0,1,2,3,5][types]!:0));assertGameState(r.state);
   if(types>0){const b=applyCommand(r.state,{kind:'take-production-bonus',actorId:s.seatOrder[0]!,good:'corn'});if(!b.ok)throw Error(b.error.message);expect(b.state.players[0]!.coins).toBe(r.state.players[0]!.coins);}
  }expect(JSON.stringify(s)).toBe(before);
 }
});
it('Factory ignores old inventory, unavailable goods, and declined production',()=>{
 const s=production(3);s.players[1]!.goods.sugar=s.supply.goods.sugar;s.supply.goods.sugar=0;s.players[0]!.goods.coffee=1;s.supply.goods.coffee--;
 const r=applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:true,useFactory:true}});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.coins).toBe(3);
 const declined=applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:false}});if(!declined.ok)throw Error(declined.error.message);expect(declined.state.players[0]!.coins).toBe(2);
 s.players[0]!.coins=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{factoryChoices:[false]}]);expect(applyCommand(s,{kind:'produce',actorId:s.seatOrder[0]!,production:{accept:true,useFactory:true}})).toMatchObject({ok:false});
});
