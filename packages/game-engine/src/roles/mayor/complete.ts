import { assertGameState, workerCapacity } from '../../invariants/assertGameState.js';
import type { GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';

/** Called once by the last allocation, before automatic role rotation. */
export function completeRecruiter(state:GameState):GameResult {
 if(state.phase.kind!=='phase-completion' || state.phase.role!=='recruiter' || state.supply.workRegisterCount!==0)throw new Error('Expected unrefilled Recruiter completion');
 const empty=state.players.reduce((n,p)=>n+p.buildings.reduce((m,b)=>m+workerCapacity(b.buildingTypeId)-b.occupiedSlots,0),0);
 const requested=Math.max(state.seatOrder.length,empty),quantity=Math.min(requested,state.supply.workerCount);
 const trigger=quantity<requested?{reason:'worker-shortage' as const,role:'recruiter' as const,triggeringRevision:state.revision,completion:'phase-completion' as const}:null;
 const next:GameState={...state,supply:{...state.supply,workerCount:state.supply.workerCount-quantity,workRegisterCount:quantity},endTriggers:trigger?[...state.endTriggers,trigger]:state.endTriggers};
 assertGameState(next);
 return {ok:true,state:next,events:trigger?[{kind:'end-triggered',revision:state.revision,index:0,trigger}]:[]};
}
