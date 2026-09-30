import { validWarehouseTypes } from '../../buildings/storage.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState, Good } from '../../model/state.js';
const goods:readonly Good[]=['corn','fruit','sugar','tobacco','coffee'];
export function afterRetention(state:GameState):GameState {
 if(state.phase.kind!=='captain-retention')throw new Error('Expected captain-retention');
 const phase=state.phase;
 return {...state,phase:phase.actorIndex===state.seatOrder.length-1?{kind:'phase-completion',role:'captain',roleChooserId:phase.roleChooserId}
  :{...phase,actorIndex:phase.actorIndex+1,actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!}};
}
export function retain(state:GameState,value:unknown,warehouseTypes:unknown):GameResult {
 if(state.phase.kind!=='captain-retention')throw new Error('Expected captain-retention');
 const actorId=state.phase.actorId,player=state.players.find(p=>p.playerId===actorId)!;
 const record=typeof value==='object' && value!==null && !Array.isArray(value)?value as Record<string,unknown>:null;
 if(!Number.isSafeInteger(state.revision+1) || !validWarehouseTypes(player,warehouseTypes) || !record || Object.keys(record).length!==5
  || !goods.every(g=>typeof record[g]==='number' && Number.isSafeInteger(record[g]) && (record[g] as number)>=0 && (record[g] as number)<=player.goods[g])
  || goods.reduce((n,g)=>n+(warehouseTypes.includes(g)?0:record[g] as number),0)>1)return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'CAPTAIN-006',message:'Retain protected goods plus at most one other crate.'}};
 const kept={corn:0,fruit:0,sugar:0,tobacco:0,coffee:0},supply={...state.supply.goods},events:GameEvent[]=[],revision=state.revision+1;
 for(const good of goods){kept[good]=record[good] as number;const quantity=player.goods[good]-kept[good];supply[good]+=quantity;
  if(quantity>0)events.push({kind:'goods-moved',revision,index:events.length,good,quantity,from:{kind:'player',playerId:actorId},to:{kind:'supply'}});}
 const next=afterRetention({...state,revision,players:state.players.map(p=>p.playerId===actorId?{...p,goods:kept}:p),supply:{...state.supply,goods:supply}});
 assertGameState(next);events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});return {ok:true,state:next,events};
}
