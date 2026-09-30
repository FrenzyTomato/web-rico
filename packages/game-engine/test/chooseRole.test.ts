import { expect, it } from 'vitest';
import { applyCommand, getLegalCommands, assertGameState, createId } from '../src/index.js';
import type { GameCommand } from '../src/index.js';
import { fixture } from './helpers/state.js';
it.each([
 ['planter','planter-choice'],['recruiter','recruiter-advantage'],['builder','builder-choice'],
 ['craftsman','craftsman-production'],['trader','trader-choice'],['captain','captain-loading'],['adventurer','adventurer'],
] as const)('selects %s and enters %s', (role,phase)=>{
 const s=fixture(5);const card=s.roleCards.find(c=>c.kind===role)!;card.accumulatedCoins=3;
 if(role==='trader' || role==='captain'){s.players[0]!.goods.coffee++;s.supply.goods.coffee--;}
 if(role==='craftsman'){s.players[0]!.countryside[0]!.occupied=true;s.players[0]!.buildings.push({instanceId:createId('building','fruit-depot'),buildingTypeId:'small-fruit-depot',occupiedSlots:1});s.supply.buildingStock['small-fruit-depot']--;s.supply.workerCount-=2;}
 const before=JSON.stringify(s);const actor=s.seatOrder[0]!;
 const result=applyCommand(s,{kind:'choose-role',actorId:actor,roleCardId:card.instanceId});
 expect(result.ok).toBe(true);if(!result.ok)return;
 assertGameState(result.state);expect(JSON.stringify(s)).toBe(before);
 expect(result.state.players[0]!.coins).toBe(7);expect(result.state.players.slice(1).map(p=>p.coins)).toEqual([4,4,4,4]);
 expect(result.state.phase).toMatchObject({kind:phase,actorId:actor,roleChooserId:actor,actorIndex:0});
 expect(result.state.roleCards.find(c=>c.instanceId===card.instanceId)).toMatchObject({selectedBy:actor,accumulatedCoins:0});
 expect(result.state.revision).toBe(s.revision+1);expect(result.state.rng).toEqual(s.rng);
 expect(result.events).toEqual([
  {kind:'role-selected',revision:2,index:0,playerId:actor,cardId:card.instanceId,role},
  {kind:'coins-changed',revision:2,index:1,playerId:actor,delta:3},
  {kind:'phase-changed',revision:2,index:2,from:'role-selection',to:role==='planter'?'planter-before':phase},
  ...(role==='planter'?[{kind:'phase-changed',revision:2,index:3,from:'planter-before',to:'planter-choice'}]:[]),
 ]);
 if(result.state.phase.kind==='captain-loading')expect(result.state.phase).toMatchObject({captainBonusUsed:false,consecutiveNoLoads:0});
 if(result.state.phase.kind==='craftsman-production')expect(result.state.phase.chooserProducedTypes).toEqual([]);
 expect(applyCommand(result.state,{kind:'choose-role',actorId:actor,roleCardId:card.instanceId})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
it('offers only unused card instances to the next chooser',()=>{
 const s=fixture(5);s.roleCards[0]!.selectedBy=s.seatOrder[0]!;s.roleSelectionIndex=1;s.phase={kind:'role-selection',actorId:s.seatOrder[1]!};
 const choices=getLegalCommands(s,s.seatOrder[1]!);expect(choices).toEqual([{phase:'role-selection',actorId:s.seatOrder[1],roleCardIds:s.roleCards.slice(1).map(c=>c.instanceId)}]);
 for(const card of s.roleCards.slice(1))expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:card.instanceId}).ok).toBe(true);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);
 const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:s.roleCards[0]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'ROUND-001'}});
 expect(JSON.stringify(s)).toBe(before);
});
it.each([null,42,'missing','',undefined])('rejects malformed/unavailable card ID %s without mutation',id=>{
 const s=fixture();const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:id} as unknown as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(JSON.stringify(s)).toBe(before);
});
it('rejects unauthorized selection and leaves role advantages untouched',()=>{
 const s=fixture(4);const card=s.roleCards.find(c=>c.kind==='adventurer')!;
 expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[1]!,roleCardId:card.instanceId})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:card.instanceId});if(!result.ok)throw Error(result.error.message);
 expect(result.state.players[0]!.coins).toBe(3); // optional Adventurer coin not awarded on selection
 expect(result.events.map(e=>e.kind)).toEqual(['role-selected','phase-changed']);
});
it('keeps advertised choices consistent at numeric limits',()=>{
 const s=fixture();s.players[0]!.coins=Number.MAX_SAFE_INTEGER;s.roleCards[0]!.accumulatedCoins=1;
 const choices=getLegalCommands(s,s.seatOrder[0]!);
 expect(choices).toEqual([{phase:'role-selection',actorId:s.seatOrder[0],roleCardIds:s.roleCards.slice(1).map(c=>c.instanceId)}]);
 expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[0]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 s.revision=Number.MAX_SAFE_INTEGER;
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'role-selection',actorId:s.seatOrder[0],roleCardIds:[]}]);
 expect(applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[1]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
