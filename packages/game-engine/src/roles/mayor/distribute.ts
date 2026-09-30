import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';

export function recruiterChoices(state:GameState):boolean[] {
 if(state.phase.kind!=='recruiter-advantage' || !Number.isSafeInteger(state.revision+1))return [];
 return state.supply.workerCount>0?[false,true]:[false];
}
export function recruitWorker(state:GameState,accept:unknown):GameResult {
 if(state.phase.kind!=='recruiter-advantage')throw new Error('Expected recruiter-advantage');
 if(typeof accept!=='boolean' || !recruiterChoices(state).includes(accept))return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'RECRUITER-001',message:'Choose an available Recruiter advantage option.'}};
 const revision=state.revision+1;
 const playerId=state.phase.roleChooserId;
 const next:GameState={...state,revision,
  players:accept?state.players.map(p=>p.playerId===playerId?{...p,idleWorkerCount:p.idleWorkerCount+1}:p):state.players,
  supply:accept?{...state.supply,workerCount:state.supply.workerCount-1}:state.supply,
  phase:{kind:'recruiter-distribution',roleChooserId:playerId}};
 assertGameState(next);
 const events:GameEvent[]=accept?[{kind:'workers-received',revision,index:0,playerId,quantity:1,source:'supply'}]:[];
 events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});
 return {ok:true,state:next,events};
}
/** Automatic step: distribute existing Register workers, preserving command revision. */
export function distributeWorkers(state:GameState):GameResult {
 if(state.phase.kind!=='recruiter-distribution')throw new Error('Expected recruiter-distribution');
 const chooser=state.phase.roleChooserId;
 const n=state.seatOrder.length,start=state.seatOrder.indexOf(chooser),count=state.supply.workRegisterCount;
 const gains=new Map(state.seatOrder.map((_,offset)=>[state.seatOrder[(start+offset)%n]!,Math.floor(count/n)+(offset<count%n?1:0)]));
 const next:GameState={...state,
  players:state.players.map(p=>({...p,idleWorkerCount:p.idleWorkerCount+gains.get(p.playerId)!})),
  supply:{...state.supply,workRegisterCount:0},
  phase:{kind:'recruiter-placement',roleChooserId:chooser,actorId:chooser,actorIndex:0}};
 assertGameState(next);
 const events:GameEvent[]=[];
 for(const [playerId,quantity] of gains)if(quantity>0)events.push({kind:'workers-received',revision:state.revision,index:events.length,playerId,quantity,source:'register'});
 events.push({kind:'phase-changed',revision:state.revision,index:events.length,from:state.phase.kind,to:next.phase.kind});
 return {ok:true,state:next,events};
}
