import { expect,it } from 'vitest';
import { applyCommand,assertGameState,getLegalCommands } from '../../src/index.js';
import type { GameCommand,Good } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(index=0){const s=fixture();s.roleCards[4]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'trader-choice',actorId:s.seatOrder[index]!,roleChooserId:s.seatOrder[0]!,actorIndex:index};return s;}
function stock(s:ReturnType<typeof setup>,i:number,good:Good){s.players[i]!.goods[good]++;s.supply.goods[good]--;}
const sale=(good:Good,useAdvantage=false)=>({good,useAdvantage,useSmallMarket:false,useLargeMarket:false});
it.each([['corn',0],['fruit',1],['sugar',2],['tobacco',3],['coffee',4]] as const)('base price %s is %i', (good,price)=>{
 const s=setup(1);stock(s,1,good);const before=JSON.stringify(s);
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[1]!,sale:sale(good)});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[1]!.coins).toBe(s.players[1]!.coins+price);expect(r.state.players[1]!.goods[good]).toBe(0);expect(r.state.tradingHouse).toEqual([good]);
 expect(r.events[0]).toEqual({kind:'goods-moved',revision:2,index:0,good,quantity:1,from:{kind:'player',playerId:s.seatOrder[1]},to:{kind:'trading-house'}});
 expect(r.events.filter(e=>e.kind==='coins-changed')).toEqual(price?[{kind:'coins-changed',revision:2,index:1,playerId:s.seatOrder[1],delta:price}]:[]);
 expect(JSON.stringify(s)).toBe(before);expect(r.state.rng).toEqual(s.rng);assertGameState(r.state);
});
it.each([false,true])('Coffee chooser advantage %s',useAdvantage=>{
 const s=setup();stock(s,0,'coffee');stock(s,1,'fruit');
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'trader-choice',actorId:s.seatOrder[0],canDecline:true,sales:[{...sale('coffee'),price:4},{...sale('coffee',true),price:5}]}]);
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:sale('coffee',useAdvantage)});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.coins).toBe(6+Number(useAdvantage));expect(r.state.phase).toMatchObject({kind:'trader-choice',actorId:s.seatOrder[1]});
});
it('TRD-02 clears four crates only at phase completion',()=>{
 const s=setup();s.tradingHouse=['corn','fruit','sugar'];for(const g of s.tradingHouse)s.supply.goods[g]--;stock(s,0,'coffee');stock(s,1,'tobacco');
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:sale('coffee')});if(!r.ok)throw Error(r.error.message);
 expect(r.state.tradingHouse).toEqual([]);expect(r.state.players[1]!.goods.tobacco).toBe(1);expect(r.state.supply.goods.coffee).toBe(s.supply.goods.coffee+1);
 const cleared=r.events.filter(e=>e.kind==='goods-moved' && e.from.kind==='trading-house');expect(cleared).toHaveLength(4);
 const clearIndex=r.events.indexOf(cleared[0]!);expect(r.events[clearIndex-1]).toMatchObject({kind:'phase-changed',from:'trader-choice',to:'phase-completion'});
 expect(r.events.map(e=>e.index)).toEqual(r.events.map((_,i)=>i));expect(r.events.every(e=>e.revision===2)).toBe(true);expect(r.state.phase.kind).toBe('role-selection');
});
it('retains a partial House and decline earns nothing',()=>{
 const s=setup();s.tradingHouse=['corn','fruit','sugar'];for(const g of s.tradingHouse)s.supply.goods[g]--;stock(s,0,'coffee');
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:null});if(!r.ok)throw Error(r.error.message);
 expect(r.state.tradingHouse).toEqual(s.tradingHouse);expect(r.state.players).toEqual(s.players);expect(r.state.supply).toEqual(s.supply);
});
it.each([undefined,{},42,{...sale('coffee'),quantity:2},{...sale('coffee'),useSmallMarket:true},{...sale('coffee'),useLargeMarket:true},{...sale('coffee'),useAdvantage:1},sale('fruit')])('rejects malformed/unavailable sale %j',offer=>{
 const s=setup();stock(s,0,'coffee');const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:offer} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});expect(JSON.stringify(s)).toBe(before);
});
it('rejects duplicate goods, full House and nonchooser privilege',()=>{
 const s=setup(1);stock(s,1,'coffee');s.tradingHouse=['coffee'];s.supply.goods.coffee--;
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[1]!,sale:sale('coffee')})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 s.supply.goods.coffee++;s.tradingHouse=[];
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[1]!,sale:sale('coffee',true)})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 s.tradingHouse=['corn','fruit','sugar','tobacco'];for(const g of s.tradingHouse)s.supply.goods[g]--;
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[1]!,sale:sale('coffee')})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it.each([3,4,5])('empty Trade wraps the round for %i players in one revision',n=>{
 const s=fixture(n);s.roleSelectionIndex=n-1;for(let i=0;i<n-1;i++)s.roleCards.filter(r=>r.kind!=='trader')[i]!.selectedBy=s.seatOrder[i]!;
 s.phase={kind:'role-selection',actorId:s.seatOrder[n-1]!};
 const r=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[n-1]!,roleCardId:s.roleCards[4]!.instanceId});if(!r.ok)throw Error(r.error.message);
 expect(r.state.roundNumber).toBe(2);expect(r.state.governorPlayerId).toBe(s.seatOrder[1]);expect(r.state.revision).toBe(2);expect(r.state.players).toEqual(s.players);assertGameState(r.state);
});
it('rejects wrong actors and overflow while preserving zero-value Corn sales',()=>{
 const s=setup();stock(s,0,'corn');s.players[0]!.coins=Number.MAX_SAFE_INTEGER;
 expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{sales:[{...sale('corn'),price:0}]}]);
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:sale('corn',true)})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[1]!,sale:null})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 const r=applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:sale('corn')});expect(r.ok).toBe(true);
 s.revision=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);expect(applyCommand(s,{kind:'trade',actorId:s.seatOrder[0]!,sale:null})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it('advertises only valid paired offers at the coin limit',()=>{
 const s=setup();stock(s,0,'corn');stock(s,0,'coffee');s.players[0]!.coins=Number.MAX_SAFE_INTEGER-4;
 expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{sales:[{...sale('corn'),price:0},{...sale('corn',true),price:1},{...sale('coffee'),price:4}]}]);
});
