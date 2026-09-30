import { assertGameState } from '../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../model/events.js';
import type { DecisionPhase } from '../model/phase.js';
import type { GameState, Role } from '../model/state.js';
import type { PlayerId } from '../model/ids.js';

// Shared eligibility for descriptors and execution, behind inspectDecision.
export function availableRoles(state: GameState) {
 if(state.phase.kind!=='role-selection' || !Number.isSafeInteger(state.revision+1))return [];
 const actorId=state.phase.actorId;
 const player=state.players.find(p=>p.playerId===actorId)!;
 return state.roleCards.filter(card=>card.selectedBy===null && Number.isSafeInteger(player.coins+card.accumulatedCoins));
}
function initialPhase(role: Role, actorId: PlayerId): DecisionPhase {
 const turn={actorId,roleChooserId:actorId,actorIndex:0};
 switch(role) {
  case 'planter':return {kind:'planter-before',...turn};
  case 'recruiter':return {kind:'recruiter-advantage',...turn};
  case 'builder':return {kind:'builder-choice',...turn};
  case 'craftsman':return {kind:'craftsman-production',...turn,chooserProducedTypes:[]};
  case 'trader':return {kind:'trader-choice',...turn};
  case 'captain':return {kind:'captain-loading',...turn,captainBonusUsed:false,consecutiveNoLoads:0};
  case 'adventurer':return {kind:'adventurer',...turn};
 }
}
/** Internal handler; dispatch has already checked phase and trusted actor identity. */
export function chooseRole(state: GameState, actorId: PlayerId, cardId: unknown): GameResult {
 const card=availableRoles(state).find(c=>c.instanceId===cardId);
 if(!card)return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'ROUND-001',message:'Choose an available role card.'}};
 const player=state.players.find(p=>p.playerId===actorId)!;
 const coins=player.coins+card.accumulatedCoins;
 const revision=state.revision+1;
 const phase=initialPhase(card.kind,actorId);
 const next:GameState={...state,revision,phase,
  players:state.players.map(p=>p.playerId===actorId?{...p,coins}:p),
  roleCards:state.roleCards.map(c=>c.instanceId===card.instanceId?{...c,selectedBy:actorId,accumulatedCoins:0}:c),
 };
 assertGameState(next);
 const events:GameEvent[]=[{kind:'role-selected',revision,index:0,playerId:actorId,cardId:card.instanceId,role:card.kind}];
 if(card.accumulatedCoins>0)events.push({kind:'coins-changed',revision,index:events.length,playerId:actorId,delta:card.accumulatedCoins});
 events.push({kind:'phase-changed',revision,index:events.length,from:'role-selection',to:phase.kind});
 return {ok:true,state:next,events};
}
