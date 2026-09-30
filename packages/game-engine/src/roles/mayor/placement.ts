import { assertGameState, workerCapacity } from '../../invariants/assertGameState.js';
import type { LegalAction, WorkerAllocation } from '../../model/commands.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';
import { completeRecruiter } from './complete.js';

export function placementOptions(state:GameState):Extract<LegalAction,{phase:'recruiter-placement'}> {
 if(state.phase.kind!=='recruiter-placement')throw new Error('Expected recruiter-placement');
 const actorId=state.phase.actorId,p=state.players.find(p=>p.playerId===actorId)!;
 return {phase:'recruiter-placement',actorId,totalWorkers:p.idleWorkerCount+p.countryside.filter(t=>t.occupied).length+p.buildings.reduce((n,b)=>n+b.occupiedSlots,0),
  slots:[...p.countryside.map(t=>({kind:'countryside' as const,instanceId:t.instanceId,capacity:1 as const})),...p.buildings.map(b=>({kind:'building' as const,instanceId:b.instanceId,capacity:workerCapacity(b.buildingTypeId)}))],idleOnlyWhenAllSlotsFilled:true};
}
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object' && v!==null && !Array.isArray(v);
const integer=(v:unknown):v is number=>typeof v==='number' && Number.isSafeInteger(v) && v>=0;
export function placeWorkers(state:GameState,input:unknown):GameResult {
 if(state.phase.kind!=='recruiter-placement')throw new Error('Expected recruiter-placement');
 const phase=state.phase,options=placementOptions(state),p=state.players.find(p=>p.playerId===phase.actorId)!;
 const invalid=():GameResult=>({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'RECRUITER-002',message:'Allocate every worker to owned slots, filling all slots before leaving workers idle.'}});
 if(!Number.isSafeInteger(state.revision+1) || !record(input) || Object.keys(input).length!==3 || !integer(input.idleCount) || !Array.isArray(input.countryside) || !Array.isArray(input.buildings))return invalid();
 const tiles=Array.from(input.countryside),buildings=Array.from(input.buildings);
 if(tiles.length!==p.countryside.length || buildings.length!==p.buildings.length
  || !tiles.every(t=>record(t) && Object.keys(t).length===2 && typeof t.occupied==='boolean' && p.countryside.some(owned=>owned.instanceId===t.tileId))
  || !buildings.every(b=>record(b) && Object.keys(b).length===2 && integer(b.occupiedSlots) && p.buildings.some(owned=>owned.instanceId===b.buildingId && (b.occupiedSlots as number)<=workerCapacity(owned.buildingTypeId)))
  || new Set(tiles.map(t=>t.tileId)).size!==tiles.length || new Set(buildings.map(b=>b.buildingId)).size!==buildings.length)return invalid();
 const used=tiles.filter(t=>t.occupied).length+buildings.reduce((n,b)=>n+b.occupiedSlots,0);
 if(used+input.idleCount!==options.totalWorkers || (input.idleCount>0 && used!==options.slots.reduce((n,s)=>n+s.capacity,0)))return invalid();
 const allocation:WorkerAllocation={countryside:tiles.map(t=>({tileId:t.tileId,occupied:t.occupied})),buildings:buildings.map(b=>({buildingId:b.buildingId,occupiedSlots:b.occupiedSlots})),idleCount:input.idleCount};
 const revision=state.revision+1,last=phase.actorIndex===state.seatOrder.length-1;
 const next:GameState={...state,revision,players:state.players.map(player=>player.playerId===p.playerId?{...player,idleWorkerCount:allocation.idleCount,
  countryside:player.countryside.map(t=>({...t,occupied:allocation.countryside.find(a=>a.tileId===t.instanceId)!.occupied})),
  buildings:player.buildings.map(b=>({...b,occupiedSlots:allocation.buildings.find(a=>a.buildingId===b.instanceId)!.occupiedSlots}))}:player),
  phase:last?{kind:'phase-completion',role:'recruiter',roleChooserId:phase.roleChooserId}:{...phase,actorIndex:phase.actorIndex+1,actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!}};
 assertGameState(next);
 const events:GameEvent[]=[{kind:'workers-allocated',revision,index:0,playerId:p.playerId,allocation},{kind:'phase-changed',revision,index:1,from:phase.kind,to:next.phase.kind}];
 if(!last)return {ok:true,state:next,events};
 const completed=completeRecruiter(next);if(!completed.ok)return completed;
 return {...completed,events:[...events,...completed.events.map((e,i)=>({...e,index:events.length+i}))]};
}
