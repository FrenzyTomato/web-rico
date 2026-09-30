import { calculateFinalScore } from './calculateFinalScore.js';
import { assertGameState, InvariantError } from '../invariants/assertGameState.js';
import type { GameResult } from '../model/events.js';
import type { GameState } from '../model/state.js';

/** Internal role-completion boundary. Caller must finish role cleanup first.
 */
export function completeGame(state:GameState):GameResult {
 if(state.phase.kind!=='phase-completion' || state.endTriggers.length===0) {
  throw new InvariantError('ENDGAME-002','Expected a triggered, completed role');
 }
 const scores=calculateFinalScore(state);
 const next:GameState={...state,phase:{kind:'game-over',scores}};
 assertGameState(next);
 return {ok:true,state:next,events:[{kind:'phase-changed',revision:state.revision,index:0,from:'phase-completion',to:'game-over'},
  {kind:'game-scored',revision:state.revision,index:1,scores}]};
}
