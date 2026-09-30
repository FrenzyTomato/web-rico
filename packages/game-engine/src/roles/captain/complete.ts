import { completeGame } from '../../scoring/endgame.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';
import { advanceAfterRole } from '../../round/advanceRound.js';
/** Unload full cargo and Personal Ships before rotation or terminal completion. */
export function completeCaptain(state:GameState):GameResult {
 if(state.phase.kind!=='phase-completion' || state.phase.role!=='captain')throw new Error('Expected Captain completion');
 const goods={...state.supply.goods},events:GameEvent[]=[];
 const ships=state.ships.map(ship=>{
  if(ship.goodType===null || ship.loadedCount<ship.capacity)return ship;
  goods[ship.goodType]+=ship.loadedCount;events.push({kind:'goods-moved',revision:state.revision,index:events.length,good:ship.goodType,quantity:ship.loadedCount,from:{kind:'cargo-ship',shipId:ship.instanceId},to:{kind:'supply'}});
  return {...ship,goodType:null,loadedCount:0 as const};
 });
 const players=state.players.map(p=>{
  const ship=p.personalShip;if(!ship || ship.goodType===null)return p;
  goods[ship.goodType]+=ship.loadedCount;events.push({kind:'goods-moved',revision:state.revision,index:events.length,good:ship.goodType,quantity:ship.loadedCount,from:{kind:'personal-ship',playerId:p.playerId},to:{kind:'supply'}});
  return {...p,personalShip:{goodType:null,loadedCount:0 as const,usedThisPhase:false}};
 });
 let next:GameState={...state,ships,players,supply:{...state.supply,goods}};
 if(state.endTriggers.length===0){next=advanceAfterRole(next);events.push({kind:'phase-changed',revision:state.revision,index:events.length,from:state.phase.kind,to:next.phase.kind});}
 else {
  const ended=completeGame(next);
  if(!ended.ok)return ended;
  next=ended.state;events.push(...ended.events.map((event,index)=>({...event,index:events.length+index})));
 }
 assertGameState(next);return {ok:true,state:next,events};
}
