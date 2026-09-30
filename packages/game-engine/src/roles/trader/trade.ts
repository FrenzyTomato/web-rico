import { permitsTradingGood } from '../../buildings/office.js';
import { marketChoices } from '../../buildings/economy.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState, Good } from '../../model/state.js';
const prices:Record<Good,number>={corn:0,fruit:1,sugar:2,tobacco:3,coffee:4};
export function availableSales(state:GameState){
 if(state.phase.kind!=='trader-choice' || state.tradingHouse.length===4 || !Number.isSafeInteger(state.revision+1))return [];
 const phase=state.phase,p=state.players.find(p=>p.playerId===phase.actorId)!;
 return (Object.keys(prices) as Good[]).flatMap(good=>p.goods[good]>0 && permitsTradingGood(p,state.tradingHouse,good)
  ?(phase.actorIndex===0?[false,true]:[false]).flatMap(useAdvantage=>{
   return marketChoices(p).flatMap(({useSmallMarket,useLargeMarket,income})=>{
    const price=prices[good]+Number(useAdvantage)+income;
    return Number.isSafeInteger(p.coins+price)?[{good,useAdvantage,useSmallMarket,useLargeMarket,price}]:[];
   });
  }):[]);
}
export function afterTrade(state:GameState):GameState {
 if(state.phase.kind!=='trader-choice')throw new Error('Expected trader-choice');
 const phase=state.phase;
 return {...state,phase:phase.actorIndex===state.seatOrder.length-1?{kind:'phase-completion',role:'trader',roleChooserId:phase.roleChooserId}
  :{...phase,actorIndex:phase.actorIndex+1,actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!}};
}
export function trade(state:GameState,sale:unknown):GameResult {
 if(state.phase.kind!=='trader-choice')throw new Error('Expected trader-choice');
 const record=typeof sale==='object' && sale!==null && !Array.isArray(sale)?sale as Record<string,unknown>:null;
 const offer=record && Object.keys(record).length===4
  ?availableSales(state).find(o=>o.good===record.good && o.useAdvantage===record.useAdvantage && o.useSmallMarket===record.useSmallMarket && o.useLargeMarket===record.useLargeMarket):undefined;
 if(!Number.isSafeInteger(state.revision+1) || (sale!==null && !offer))return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'TRADER-001',message:'Sell one eligible owned crate with available privileges, or decline.'}};
 const revision=state.revision+1,actorId=state.phase.actorId;
 const next=afterTrade({...state,revision,
  players:offer?state.players.map(p=>p.playerId===actorId?{...p,coins:p.coins+offer.price,goods:{...p.goods,[offer.good]:p.goods[offer.good]-1}}:p):state.players,
  tradingHouse:offer?[...state.tradingHouse,offer.good]:state.tradingHouse});
 assertGameState(next);
 const events:GameEvent[]=[];
 if(offer){events.push({kind:'goods-moved',revision,index:0,good:offer.good,quantity:1,from:{kind:'player',playerId:actorId},to:{kind:'trading-house'}});
  if(offer.price>0)events.push({kind:'coins-changed',revision,index:events.length,playerId:actorId,delta:offer.price});}
 events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});
 return {ok:true,state:next,events};
}
/** Role cleanup only; the automatic runner then rotates to the next chooser. */
export function completeTrade(state:GameState):GameResult {
 if(state.phase.kind!=='phase-completion' || state.phase.role!=='trader')throw new Error('Expected Trader completion');
 if(state.tradingHouse.length<4)return {ok:true,state,events:[]};
 const goods={...state.supply.goods};const events:GameEvent[]=[];
 for(const good of state.tradingHouse){goods[good]++;events.push({kind:'goods-moved',revision:state.revision,index:events.length,good,quantity:1,from:{kind:'trading-house'},to:{kind:'supply'}});}
 const next={...state,tradingHouse:[],supply:{...state.supply,goods}};assertGameState(next);
 return {ok:true,state:next,events};
}
