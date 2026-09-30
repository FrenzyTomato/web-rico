import { assertGameState, InvariantError } from '../invariants/assertGameState.js';
import type { GameState } from '../model/state.js';

function requireRotation(state:GameState, phase:'phase-completion'|'round-completion'):void {
 assertGameState(state);
 if(state.endTriggers.length>0)throw new InvariantError('ENDGAME-002','Scoring is required before any further role or round');
 if(state.phase.kind!==phase)throw new InvariantError('ROUND-002',`Expected ${phase}`);
}
/** Internal only. Caller must have finished role-specific cleanup before calling.
 * PR-013 owns automatic chaining/events; this step does not increment revision.
 */
export function advanceAfterRole(state:GameState):GameState {
 requireRotation(state,'phase-completion');
 const n=state.seatOrder.length;
 const next:GameState=state.roleSelectionIndex===n-1
  ? {...state,phase:{kind:'round-completion'}}
  : {...state,roleSelectionIndex:state.roleSelectionIndex+1,phase:{kind:'role-selection',
      actorId:state.seatOrder[(state.seatOrder.indexOf(state.governorPlayerId)+state.roleSelectionIndex+1)%n]!}};
 assertGameState(next);
 return next;
}
/** Finish a nonterminal round: pay only unchosen cards and rotate Governor once. */
export function advanceRound(state:GameState):GameState {
 requireRotation(state,'round-completion');
 const roundNumber=state.roundNumber+1;
 if(!Number.isSafeInteger(roundNumber) || state.roleCards.some(card=>card.selectedBy===null && !Number.isSafeInteger(card.accumulatedCoins+1))) {
  throw new InvariantError('ROUND-002','Numeric state limit exceeded');
 }
 const governorPlayerId=state.seatOrder[(state.seatOrder.indexOf(state.governorPlayerId)+1)%state.seatOrder.length]!;
 const next:GameState={...state,roundNumber,governorPlayerId,roleSelectionIndex:0,
  roleCards:state.roleCards.map(card=>({...card,selectedBy:null,accumulatedCoins:card.accumulatedCoins+(card.selectedBy===null?1:0)})),
  phase:{kind:'role-selection',actorId:governorPlayerId},
 };
 assertGameState(next);
 return next;
}
