import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,getLegalCommands } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(active=true){const s=fixture();s.governorPlayerId=s.seatOrder[2]!;s.roleCards[4]!.selectedBy=s.seatOrder[2]!;s.phase={kind:'trader-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[2]!,actorIndex:1};s.players[0]!.buildings.push({instanceId:createId('building','office'),buildingTypeId:'office',occupiedSlots:Number(active)});s.supply.buildingStock.office--;s.supply.workerCount-=Number(active);s.tradingHouse=['fruit'];s.supply.goods.fruit-=2;s.players[0]!.goods.fruit=1;return s;}
const sale={good:'fruit' as const,useAdvantage:false,useSmallMarket:false,useLargeMarket:false};
it('B-12 active Office permits a duplicate Fruit sale once, with ordinary income',()=>{
 const s=setup(),before=JSON.stringify(s);expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{sales:[{...sale,price:1}]}]);
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale});if(!r.ok)throw Error(r.error.message);
 expect(r.state.tradingHouse).toEqual(['fruit','fruit']);expect(r.state.players[0]!.coins).toBe(3);expect(r.state.players[0]!.goods.fruit).toBe(0);expect(r.state.supply).toEqual(s.supply);expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
 expect(applyCommand(r.state,{kind:'trade',actorId:s.seatOrder[0]!,sale}).ok).toBe(false);
});
it.each(['inactive','full'] as const)('rejects duplicate with %s Office/House without mutation',mode=>{
 const s=setup(mode!=='inactive');if(mode==='full'){s.tradingHouse.push('corn','sugar','coffee');s.supply.goods.corn--;s.supply.goods.sugar--;s.supply.goods.coffee--;}
 const before=JSON.stringify(s);expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{sales:[]}]);expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});expect(JSON.stringify(s)).toBe(before);
});
it('duplicate fourth crate clears only at phase end and all copies return to supply',()=>{
 const s=setup();s.tradingHouse.push('fruit','sugar');s.supply.goods.fruit--;s.supply.goods.sugar--;
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale});if(!r.ok)throw Error(r.error.message);
 expect(r.state.tradingHouse).toEqual([]);expect(r.state.supply.goods.fruit).toBe(11);expect(r.state.supply.goods.sugar).toBe(11);
 const returns=r.events.filter(e=>e.kind==='goods-moved' && e.from.kind==='trading-house');expect(returns).toHaveLength(4);expect(r.events[r.events.indexOf(returns[0]!)-1]).toMatchObject({kind:'phase-changed',to:'phase-completion'});assertGameState(r.state);
});
it('declining Office-enabled trade grants nothing',()=>{
 const s=setup();const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:null});if(!r.ok)throw Error(r.error.message);expect(r.state.players).toEqual(s.players);expect(r.state.tradingHouse).toEqual(s.tradingHouse);
});
