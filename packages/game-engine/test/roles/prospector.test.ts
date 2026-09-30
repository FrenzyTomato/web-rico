import { expect,it } from 'vitest';
import { applyCommand,assertGameState,getLegalCommands } from '../../src/index.js';
import type { GameCommand,GameState } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function select(s=fixture(5),ordinal=0){const card=s.roleCards.filter(c=>c.kind==='adventurer')[ordinal]!;const r=applyCommand(s,{kind:'choose-role',actorId:'actorId' in s.phase?s.phase.actorId:s.seatOrder[0]!,roleCardId:card.instanceId});if(!r.ok)throw Error(r.error.message);return r.state;}
it.each([false,true])('ADV-01 card income independent of accept=%s',accept=>{
 const s=fixture(5);s.players[0]!.coins=2;s.roleCards[6]!.accumulatedCoins=3;const selected=select(s);expect(selected.players[0]!.coins).toBe(5);
 const before=JSON.stringify(selected);
 expect(getLegalCommands(selected,s.seatOrder[0]!)).toEqual([{phase:'adventurer',actorId:s.seatOrder[0],accept:[false,true]}]);
 const r=applyCommand(selected,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.coins).toBe(accept?6:5);expect(r.state.players.slice(1)).toEqual(selected.players.slice(1));
 expect(r.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});expect(r.state.rng).toEqual(selected.rng);expect(r.state.supply).toEqual(selected.supply);expect(JSON.stringify(selected)).toBe(before);
 expect(r.events).toEqual([...(accept?[{kind:'coins-changed',playerId:s.seatOrder[0],delta:1}]:[]),{kind:'phase-changed',from:'adventurer',to:'phase-completion'},{kind:'phase-changed',from:'phase-completion',to:'role-selection'}].map((e,index)=>({...e,index,revision:3})));
 const second=applyCommand(r.state,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:s.roleCards[7]!.instanceId});expect(second.ok).toBe(true);assertGameState(r.state);
});
it.each([3,4,5])('has %i-player card inventory',n=>{expect(fixture(n).roleCards.filter(c=>c.kind==='adventurer')).toHaveLength(n-3);});
it('permits 83→84 and rejects nonchoosers, malformed choices and repeats',()=>{
 const s=fixture(4);s.players[0]!.coins=83;const state=select(s);const before=JSON.stringify(state);
 expect(getLegalCommands(state,s.seatOrder[1]!)).toEqual([]);
 expect(applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[1]!,accept:true})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 for(const accept of [undefined,null,0,1,'true',{},[]])expect(applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(JSON.stringify(state)).toBe(before);const r=applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept:true});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.coins).toBe(84);expect(applyCommand(r.state,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept:true}).ok).toBe(false);
});
it('guards numeric limits with matching legal choices',()=>{
 const s=fixture(4);s.players[0]!.coins=Number.MAX_SAFE_INTEGER;const state=select(s);
 expect(getLegalCommands(state,s.seatOrder[0]!)).toMatchObject([{accept:[false]}]);expect(applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept:true})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept:false}).ok).toBe(true);
 const capped:GameState={...state,revision:Number.MAX_SAFE_INTEGER};expect(getLegalCommands(capped,s.seatOrder[0]!)).toMatchObject([{accept:[]}]);expect(applyCommand(capped,{kind:'take-adventurer-coin',actorId:s.seatOrder[0]!,accept:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it.each([4,5])('last chooser completes the round for %i players',n=>{
 const s=fixture(n);s.roleSelectionIndex=n-1;for(let i=0;i<n-1;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i]!;s.phase={kind:'role-selection',actorId:s.seatOrder[n-1]!};
 const state=select(s);const r=applyCommand(state,{kind:'take-adventurer-coin',actorId:s.seatOrder[n-1]!,accept:true});if(!r.ok)throw Error(r.error.message);
 expect(r.state.roundNumber).toBe(2);expect(r.state.governorPlayerId).toBe(s.seatOrder[1]);expect(r.state.revision).toBe(3);expect(r.state.roleCards.filter(c=>c.accumulatedCoins===1)).toHaveLength(3);expect(r.events.every(e=>e.revision===3)).toBe(true);assertGameState(r.state);
});
