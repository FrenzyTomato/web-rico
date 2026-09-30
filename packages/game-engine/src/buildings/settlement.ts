import { assertGameState } from '../invariants/assertGameState.js';
import type { GameEvent,GameResult } from '../model/events.js';
import type { GameState } from '../model/state.js';
import { shuffle } from '../rng/seeded.js';
import { isBuildingActive } from './activation.js';
export function canUseHacienda(state:GameState):boolean {
 if(state.phase.kind!=='planter-before')return false;
 const actorId=state.phase.actorId,p=state.players.find(p=>p.playerId===actorId)!;
 return isBuildingActive(p,'hacienda') && p.countryside.length<12 && state.estateBag.length+state.estateDiscard.length>0;
}
export function hospitalDestinations(state:GameState) {
 if(state.phase.kind!=='planter-worker')throw new Error('Expected planter-worker');
 const phase=state.phase,p=state.players.find(p=>p.playerId===phase.actorId)!;
 return [null,...(isBuildingActive(p,'hospital') && state.supply.workerCount+state.supply.workRegisterCount>0
  ?phase.acquiredTileIds.filter(id=>p.countryside.some(t=>t.instanceId===id && !t.occupied)):[])];
}
export function afterPlanting(state:GameState):GameState {
 if(state.phase.kind!=='planter-worker')throw new Error('Expected planter-worker');
 const phase=state.phase,actorIndex=phase.actorIndex+1;
 return {...state,phase:actorIndex===state.seatOrder.length?{kind:'phase-completion',role:'planter',roleChooserId:phase.roleChooserId}
  :{kind:'planter-before',actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+actorIndex)%state.seatOrder.length]!,roleChooserId:phase.roleChooserId,actorIndex}};
}
const invalid=():GameResult=>({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'PLANTER-002',message:'Choose an available planting ability option.'}});
export function useHacienda(state:GameState,accept:unknown):GameResult {
 if(state.phase.kind!=='planter-before')throw new Error('Expected planter-before');
 if(typeof accept!=='boolean' || !Number.isSafeInteger(state.revision+1) || (accept && !canUseHacienda(state)))return invalid();
 const revision=state.revision+1,phase=state.phase,actorId=phase.actorId;
 let bag=state.estateBag,discard=state.estateDiscard,rng=state.rng;
 if(accept && bag.length===0){const mixed=shuffle(rng,discard);bag=mixed.items;discard=[];rng=mixed.rng;}
 const tile=accept?{...bag[0]!,occupied:false}:null;
 const next:GameState={...state,revision,estateBag:tile?bag.slice(1):bag,estateDiscard:discard,rng,
  players:tile?state.players.map(p=>p.playerId===actorId?{...p,countryside:[...p.countryside,tile]}:p):state.players,
  phase:{...phase,kind:'planter-choice',acquiredTileIds:tile?[tile.instanceId]:[]}};
 assertGameState(next);
 const events:GameEvent[]=tile?[{kind:'tile-placed',revision,index:0,playerId:actorId,tile}]:[];
 events.push({kind:'phase-changed',revision,index:events.length,from:phase.kind,to:next.phase.kind});return {ok:true,state:next,events};
}
export function useHospital(state:GameState,tileId:unknown):GameResult {
 if(state.phase.kind!=='planter-worker')throw new Error('Expected planter-worker');
 if(!Number.isSafeInteger(state.revision+1) || !hospitalDestinations(state).some(id=>id===tileId))return invalid();
 const revision=state.revision+1,actorId=state.phase.actorId,source=state.supply.workerCount>0?'supply':'register';
 const players=tileId===null?state.players:state.players.map(p=>p.playerId===actorId?{...p,countryside:p.countryside.map(t=>t.instanceId===tileId?{...t,occupied:true}:t)}:p);
 const next=afterPlanting({...state,revision,players,supply:tileId===null?state.supply:{...state.supply,
  workerCount:state.supply.workerCount-Number(source==='supply'),workRegisterCount:state.supply.workRegisterCount-Number(source==='register')}});
 assertGameState(next);const events:GameEvent[]=[];
 if(tileId!==null){const p=players.find(p=>p.playerId===actorId)!;events.push({kind:'workers-received',revision,index:0,playerId:actorId,quantity:1,source},
  {kind:'workers-allocated',revision,index:1,playerId:actorId,allocation:{countryside:p.countryside.map(t=>({tileId:t.instanceId,occupied:t.occupied})),buildings:p.buildings.map(b=>({buildingId:b.instanceId,occupiedSlots:b.occupiedSlots})),idleCount:p.idleWorkerCount}});}
 events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});return {ok:true,state:next,events};
}
