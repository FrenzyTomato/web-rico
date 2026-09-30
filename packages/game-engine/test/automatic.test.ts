import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createGame, createId, RULESET } from '../src/index.js';
import type { GameEvent, GameResult, GameState } from '../src/index.js';
import { advanceAutomatic } from '../src/round/advanceAutomatic.js';
import { fixture } from './helpers/state.js';

const accepted = (state: GameState, events: readonly GameEvent[]=[]): GameResult => ({ok:true,state,events});
function bonus(n=3, last=false) {
  const s=fixture(n);s.roleSelectionIndex=last?n-1:0;
  const others=s.roleCards.filter(card=>card.kind!=='craftsman');
  for(let i=0;i<s.roleSelectionIndex;i++)others[i]!.selectedBy=s.seatOrder[i]!;
  const actorId=s.seatOrder[s.roleSelectionIndex]!;
  s.roleCards.find(card=>card.kind==='craftsman')!.selectedBy=actorId;
  s.phase={kind:'craftsman-bonus',actorId,roleChooserId:actorId,actorIndex:0,chooserProducedTypes:[]};
  return s;
}
function terminal() {
  const s=fixture();s.roleCards.find(card=>card.kind==='captain')!.selectedBy=s.seatOrder[0]!;
  s.players[0]!.earnedVp=75;s.supply.vpRemaining=0;
  s.endTriggers=[{reason:'vp-exhausted',role:'captain',triggeringRevision:1,completion:'phase-completion'}];
  s.phase={kind:'game-over',scores:s.players.map((p,i)=>({playerId:p.playerId,earnedVp:p.earnedVp,
    baseBuildingVp:0,bonuses:{'fire-station':0,residence:0,fortress:0,'customs-house':0,'city-hall':0},
    totalVp:p.earnedVp,tieBreakCoinsAndGoods:2,rank:i===0?1:2}))};
  return s;
}

function freeze(value: unknown): void {
  if(value && typeof value==='object') { for(const child of Object.values(value)) freeze(child);Object.freeze(value); }
}

it.each([3,4,5])('PLANTER-002: selection skips unavailable Hacienda in one revision for %i players',n=>{
  const seats=Array.from({length:n},(_,i)=>createId('player',`p${i}`));
  const initial=createGame({rulesetId:RULESET.id,gameId:createId('game','automatic'),seatOrder:seats,governorPlayerId:seats[0]!,seed:0});
  if(!initial.ok)throw Error(initial.error.message);
  const state=initial.state;const before=JSON.stringify(state);freeze(state);
  const command={kind:'choose-role',actorId:seats[0]!,roleCardId:state.roleCards[0]!.instanceId} as const;freeze(command);
  const result=applyCommand(state,command);if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...state,revision:1,
    roleCards:state.roleCards.map((card,i)=>i===0?{...card,selectedBy:seats[0]}:card),
    phase:{kind:'planter-choice',actorId:seats[0],roleChooserId:seats[0],actorIndex:0,acquiredTileIds:[]},
  });
  expect(result.events).toEqual([
    {kind:'role-selected',revision:1,index:0,playerId:seats[0],cardId:state.roleCards[0]!.instanceId,role:'planter'},
    {kind:'phase-changed',revision:1,index:1,from:'role-selection',to:'planter-before'},
    {kind:'phase-changed',revision:1,index:2,from:'planter-before',to:'planter-choice'},
  ]);
  assertGameState(result.state);expect(JSON.stringify(state)).toBe(before);
  expect(applyCommand(state,command)).toEqual(result);
});

it.each([0,1])('PLANTER-002: stops for usable Hacienda only, with %i workers',workers=>{
  const s=fixture();s.supply.buildingStock.hacienda--;s.supply.workerCount-=workers;
  s.players[0]!.buildings.push({instanceId:createId('building','hacienda'),buildingTypeId:'hacienda',occupiedSlots:workers});
  const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[0]!.instanceId});
  if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase.kind).toBe(workers===1?'planter-before':'planter-choice');
  expect(result.state.estateBag).toEqual(s.estateBag);expect(result.state.rng).toEqual(s.rng);
  expect(result.state.players).toEqual(s.players);
});

it.each(['full','exhausted'] as const)('PLANTER-002: skips occupied Hacienda with %s acquisition',reason=>{
  const s=fixture(5);s.supply.buildingStock.hacienda--;s.supply.workerCount--;
  s.players[0]!.buildings.push({instanceId:createId('building','hacienda'),buildingTypeId:'hacienda',occupiedSlots:1});
  if(reason==='full')s.players[0]!.countryside.push(...s.estateBag.splice(0,11).map(tile=>({...tile,occupied:false})));
  else {
    const tiles=[...s.estateBag,...s.estateMarket];s.estateBag=[];s.estateMarket=[];
    for(const p of s.players)p.countryside.push(...tiles.splice(0,9).map(tile=>({...tile,occupied:false})));
    expect(tiles).toHaveLength(0);
  }
  assertGameState(s);
  const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[0]!.instanceId});
  if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase.kind).toBe('planter-choice');expect(result.state.rng).toEqual(s.rng);
});

it.each([3,4,5])('ROUND-002: chains bonus/phase/round boundaries once for %i players',n=>{
  const s=bonus(n,true);let i=0;
  for(const card of s.roleCards)if(card.selectedBy===null)card.accumulatedCoins=[0,2,4][i++]!;
  const pending=accepted(s,[{kind:'phase-changed',revision:1,index:0,from:'craftsman-production',to:'craftsman-bonus'}]);
  const before=JSON.stringify(pending);freeze(pending);
  const result=advanceAutomatic(pending);if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,roundNumber:2,roleSelectionIndex:0,governorPlayerId:s.seatOrder[1],
    phase:{kind:'role-selection',actorId:s.seatOrder[1]},
    roleCards:s.roleCards.map(card=>({...card,selectedBy:null,accumulatedCoins:card.selectedBy===null?card.accumulatedCoins+1:0})),
  });
  expect(result.state.roleCards.filter((_,index)=>s.roleCards[index]!.selectedBy===null).map(card=>card.accumulatedCoins)).toEqual([1,3,5]);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'craftsman-production',to:'craftsman-bonus'},
    {kind:'phase-changed',revision:1,index:1,from:'craftsman-bonus',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:2,from:'phase-completion',to:'round-completion'},
    {kind:'phase-changed',revision:1,index:3,from:'round-completion',to:'role-selection'},
  ]);
  expect(JSON.stringify(pending)).toBe(before);assertGameState(result.state);
  expect(advanceAutomatic(result)).toEqual(result);
});

it('CRAFTSMAN-003: unavailable produced goods skip, but an available bonus remains a choice',()=>{
  const s=bonus();if(s.phase.kind!=='craftsman-bonus')throw Error('fixture');
  s.phase.chooserProducedTypes=['corn'];s.supply.goods.corn=0;s.players[0]!.goods.corn=10;
  s.players[0]!.goods.coffee=1;s.supply.goods.coffee--;
  const result=advanceAutomatic(accepted(s));if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,roleSelectionIndex:1,phase:{kind:'role-selection',actorId:s.seatOrder[1]}});
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'craftsman-bonus',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:1,from:'phase-completion',to:'role-selection'},
  ]);
  s.supply.goods.corn=1;s.players[0]!.goods.corn=9;
  expect(advanceAutomatic(accepted(s))).toEqual(accepted(s));
});

it('ROLE-001: stops at player decisions without accepting or declining on their behalf',()=>{
  const s=fixture(4);s.roleCards[6]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'adventurer',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};
  expect(advanceAutomatic(accepted(s))).toEqual(accepted(s));
  s.phase={kind:'phase-completion',role:'adventurer',roleChooserId:s.seatOrder[0]!};
  const result=advanceAutomatic(accepted(s));if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.players).toEqual(s.players);
});

it.each(['captain'] as const)('completes %s cleanup',role=>{
  const s=fixture();s.roleCards.find(card=>card.kind===role)!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'phase-completion',role,roleChooserId:s.seatOrder[0]!};
  const before=JSON.stringify(s);freeze(s);
  expect(advanceAutomatic(accepted(s))).toMatchObject({ok:true,state:{phase:{kind:'role-selection'}}});
  expect(JSON.stringify(s)).toBe(before);
});

it('distributes the Register and terminates a completed ending role',()=>{
  const s=fixture();s.roleCards[1]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'recruiter-distribution',roleChooserId:s.seatOrder[0]!};
  expect(advanceAutomatic(accepted(s))).toMatchObject({ok:true,state:{phase:{kind:'recruiter-placement'},supply:{workRegisterCount:0}}});
  const ending=terminal();ending.phase={kind:'phase-completion',role:'captain',roleChooserId:ending.seatOrder[0]!};
  const before=JSON.stringify(ending);freeze(ending);
  expect(advanceAutomatic(accepted(ending))).toMatchObject({ok:true,state:{phase:{kind:'game-over',scores:expect.any(Array)}}});
  expect(JSON.stringify(ending)).toBe(before);
});

it('ENDGAME-002: never invokes another step after game over, including mid-chain',()=>{
  const ended=terminal();freeze(ended);
  expect(advanceAutomatic(accepted(ended),()=>{throw Error('must not run');})).toEqual(accepted(ended));
  const s={...ended,phase:{kind:'phase-completion',role:'captain',roleChooserId:ended.seatOrder[0]!}} as const;
  let calls=0;
  const result=advanceAutomatic(accepted(s),()=>{
    calls++;if(calls>1)throw Error('must not run');
    return accepted(ended,[{kind:'phase-changed',revision:1,index:0,from:'phase-completion',to:'game-over'}]);
  });
  expect(calls).toBe(1);expect(result).toEqual(accepted(ended,[{kind:'phase-changed',revision:1,index:0,from:'phase-completion',to:'game-over'}]));
});

it('ROLE-001: rejects structural no-ops and bounds a changing artificial loop',()=>{
  const s=bonus();freeze(s);
  expect(()=>advanceAutomatic(accepted(s),current=>accepted({...current}))).toThrow('no progress');
  let calls=0;
  expect(()=>advanceAutomatic(accepted(s),current=>{
    calls++;
    return accepted({...current,phase:current.phase.kind==='craftsman-bonus'
      ? {kind:'phase-completion',role:'craftsman',roleChooserId:s.seatOrder[0]!}
      : s.phase});
  })).toThrow('step limit');
  expect(calls).toBe(128);
});

it('ROLE-001: a step cannot change revision, corrupt state, or stop at an automatic phase',()=>{
  const s=bonus();
  expect(()=>advanceAutomatic(accepted(s),current=>accepted({...current,revision:2}))).toThrow('revision');
  expect(()=>advanceAutomatic(accepted(s),current=>accepted(current,[
    {kind:'phase-changed',revision:2,index:0,from:'craftsman-bonus',to:'phase-completion'},
  ]))).toThrow('revision');
  expect(()=>advanceAutomatic(accepted(s),current=>accepted({...current,supply:{...current.supply,workerCount:0}}))).toThrow('INVARIANT-002');
  s.phase={kind:'phase-completion',role:'craftsman',roleChooserId:s.seatOrder[0]!};
  expect(()=>advanceAutomatic(accepted(s),()=>null)).toThrow('decision');
});

it('preserves command rejection and returns no partial state or events on step failure',()=>{
  const failure={ok:false,error:{code:'UNSUPPORTED_PHASE',ruleId:'ROLE-001',message:'Not implemented.'}} as const;
  expect(advanceAutomatic(failure,()=>{throw Error('must not run');})).toBe(failure);
  const pending=accepted(bonus());const before=JSON.stringify(pending);freeze(pending);
  let calls=0;
  expect(advanceAutomatic(pending,current=>++calls===1
    ? accepted({...current,phase:{kind:'phase-completion',role:'craftsman',roleChooserId:current.seatOrder[0]!}})
    : failure)).toBe(failure);
  expect(calls).toBe(2);expect(JSON.stringify(pending)).toBe(before);
});
