import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';

export function adventurerChoices(state:GameState):boolean[] {
 if(state.phase.kind!=='adventurer' || !Number.isSafeInteger(state.revision+1))return [];
 const actorId=state.phase.actorId,player=state.players.find(p=>p.playerId===actorId)!;
 return Number.isSafeInteger(player.coins+1)?[false,true]:[false];
}
export function resolveAdventurer(state:GameState,accept:unknown):GameResult {
 if(state.phase.kind!=='adventurer')throw new Error('Expected adventurer');
 if(typeof accept!=='boolean' || !adventurerChoices(state).includes(accept))return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'ADVENTURER-001',message:'Accept or decline the available Adventurer coin.'}};
 const actorId=state.phase.actorId,revision=state.revision+1;
 const next:GameState={...state,revision,
  players:accept?state.players.map(p=>p.playerId===actorId?{...p,coins:p.coins+1}:p):state.players,
  phase:{kind:'phase-completion',role:'adventurer',roleChooserId:actorId}};
 assertGameState(next);
 const events:GameEvent[]=accept?[{kind:'coins-changed',revision,index:0,playerId:actorId,delta:1}]:[];
 events.push({kind:'phase-changed',revision,index:events.length,from:'adventurer',to:'phase-completion'});
 return {ok:true,state:next,events};
}
