import { chooseRole } from '../src/round/chooseRole.js';
import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createGame, createId, RULESET } from '../src/index.js';
import type { GameCommand, GameState, Role } from '../src/index.js';
import { advanceAfterRole, advanceRound } from '../src/round/advanceRound.js';
import { fixture } from './helpers/state.js';
function completed(s:GameState,role:Role):GameState {
 // Test-only completion signal: no production command bypasses role actions.
 return {...s,phase:{kind:'phase-completion',role,roleChooserId:s.seatOrder[(s.seatOrder.indexOf(s.governorPlayerId)+s.roleSelectionIndex)%s.seatOrder.length]!}};
}
it.each([
 {n:3,first:[0,1,2],second:[1,2,0],coins:[0,0,1,2,2,0]},
 {n:4,first:[0,1,2,3],second:[1,2,3,0],coins:[0,0,0,1,2,2,0]},
 {n:5,first:[0,1,2,3,4],second:[1,2,3,4,0],coins:[0,0,0,0,1,2,2,0]},
])('rotates two rounds for $n players with exact bonuses',v=>{
 const seats=Array.from({length:v.n},(_,i)=>createId('player',`p${i}`));
 const initial=createGame({rulesetId:RULESET.id,gameId:createId('game','round-test'),seatOrder:seats,governorPlayerId:seats[0]!,seed:0});
 if(!initial.ok)throw Error(initial.error.message);let state=initial.state;
 for(let round=0;round<2;round++) {
  const chosen: string[]=[];
  for(let i=0;i<v.n;i++) {
   const actor=seats[(round===0?v.first:v.second)[i]!]!;
   expect(state.phase).toEqual({kind:'role-selection',actorId:actor});
   const card=state.roleCards[round===0?i:i===0?v.n+2:i-1]!;
   expect(card.selectedBy).toBeNull();expect(chosen).not.toContain(card.instanceId);chosen.push(card.instanceId);
   // Isolate rotation: role completion is simulated by this test.
   const result=chooseRole(state,actor,card.instanceId);if(!result.ok)throw Error(result.error.message);
   const signal=completed(result.state,card.kind);const before=JSON.stringify(signal);
   state=advanceAfterRole(signal);expect(JSON.stringify(signal)).toBe(before);
   expect(state.revision).toBe(result.state.revision);expect(state.rng).toEqual(result.state.rng);assertGameState(state);
   if(i<v.n-1)expect(state.roleCards.filter(r=>r.selectedBy!==null)).toHaveLength(i+1);
  }
  expect(state.phase.kind).toBe('round-completion');const before=JSON.stringify(state);const revision=state.revision;
  const prior=state;state=advanceRound(state);expect(JSON.stringify(prior)).toBe(before);expect(state.revision).toBe(revision);assertGameState(state);
  expect(state.roundNumber).toBe(round+2);expect(state.governorPlayerId).toBe(seats[round+1]);expect(state.roleSelectionIndex).toBe(0);
  expect(state.roleCards.every(r=>r.selectedBy===null)).toBe(true);
  if(round===0)expect(state.roleCards.map(r=>r.accumulatedCoins)).toEqual([...Array(v.n).fill(0),1,1,1]);
 }
 expect(state.roleCards.map(r=>r.accumulatedCoins)).toEqual(v.coins);
 expect(state.players.map(p=>p.coins)).toEqual(Array.from({length:v.n},(_,i)=>v.n-1+(i===1?1:0)));
 expect(state.revision).toBe(2*v.n); // only accepted selections advanced revisions
});
it('wraps Governor and chooses from Governor order, not player array order',()=>{
 const s=fixture();s.governorPlayerId=s.seatOrder[2]!;s.roleSelectionIndex=2;
 for(let i=0;i<3;i++)s.roleCards[i]!.selectedBy=s.seatOrder[(i+2)%3]!;
 s.players.reverse();s.phase={kind:'round-completion'};
 const next=advanceRound(s);expect(next.governorPlayerId).toBe(s.seatOrder[0]);expect(next.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[0]});
});
it('rejects premature completion, repeat advancement and player skip commands',()=>{
 const s=fixture();expect(()=>advanceAfterRole(s)).toThrow();expect(()=>advanceRound(s)).toThrow();
 expect(applyCommand(s,{kind:'end-role',actorId:s.seatOrder[0]} as unknown as GameCommand)).toMatchObject({ok:false,error:{code:'UNKNOWN_COMMAND'}});
 const selected=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[2]!.instanceId});if(!selected.ok)throw Error(selected.error.message);
 expect(()=>advanceAfterRole(selected.state)).toThrow();
 const next=advanceAfterRole(completed(selected.state,'builder'));expect(()=>advanceAfterRole(next)).toThrow();
 expect(next.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
});
it('never rotates or pays round bonuses after an end trigger',()=>{
 const s=fixture();s.roleCards.find(r=>r.kind==='captain')!.selectedBy=s.seatOrder[0]!;
 s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;
 s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
 s.phase={kind:'phase-completion',role:'captain',roleChooserId:s.seatOrder[0]!};
 const before=JSON.stringify(s);expect(()=>advanceAfterRole(s)).toThrow('ENDGAME-002');expect(()=>advanceRound(s)).toThrow();expect(JSON.stringify(s)).toBe(before);
});
it('rejects unsafe round and role-coin increments before mutation',()=>{
 const s=fixture();s.roleSelectionIndex=2;for(let i=0;i<3;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i]!;s.phase={kind:'round-completion'};
 s.roundNumber=Number.MAX_SAFE_INTEGER;expect(()=>advanceRound(s)).toThrow();s.roundNumber=1;
 s.roleCards[3]!.accumulatedCoins=Number.MAX_SAFE_INTEGER;const before=JSON.stringify(s);expect(()=>advanceRound(s)).toThrow();expect(JSON.stringify(s)).toBe(before);
});
