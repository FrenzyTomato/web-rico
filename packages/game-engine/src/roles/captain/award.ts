import { assertGameState, InvariantError } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';

/** Award an actual load before advancing its actor; keep the accepted revision. */
export function awardShipping(state:GameState,crates:number,useHarbor=false):GameResult {
 if(state.phase.kind!=='captain-loading' || !Number.isSafeInteger(crates) || crates<=0)throw new InvariantError('CAPTAIN-003','Expected a positive Captain load');
 const phase=state.phase,bonus=phase.actorId===phase.roleChooserId && !phase.captainBonusUsed;
 const quantity=crates+Number(bonus)+Number(useHarbor),overflow=Math.max(0,quantity-state.supply.vpRemaining);
 const remaining=Math.max(0,state.supply.vpRemaining-quantity);
 const trigger=remaining===0 && !state.endTriggers.some(t=>t.reason==='vp-exhausted')
  ?{reason:'vp-exhausted' as const,role:'captain' as const,triggeringRevision:state.revision,completion:'phase-completion' as const}:null;
 const next:GameState={...state,
  players:state.players.map(p=>p.playerId===phase.actorId?{...p,earnedVp:p.earnedVp+quantity}:p),
  supply:{...state.supply,vpRemaining:remaining,vpOverflow:state.supply.vpOverflow+overflow},
  phase:{...phase,captainBonusUsed:phase.captainBonusUsed || bonus},
  endTriggers:trigger?[...state.endTriggers,trigger]:state.endTriggers};
 assertGameState(next);
 // Canonical server-only deltas; public projection belongs to PR-035/042.
 const events:GameEvent[]=[{kind:'vp-earned',revision:state.revision,index:0,playerId:phase.actorId,quantity,overflow}];
 if(trigger)events.push({kind:'end-triggered',revision:state.revision,index:events.length,trigger});
 return {ok:true,state:next,events};
}
