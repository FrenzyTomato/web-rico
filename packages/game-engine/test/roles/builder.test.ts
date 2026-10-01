import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands, calculateFinalScore } from '../../src/index.js';
import { advanceAutomatic } from '../../src/round/advanceAutomatic.js';
import type { BuildingType, GameCommand, GameState } from '../../src/index.js';
import { fixture } from '../helpers/state.js';

function builder(n=3, actorIndex=0) {
  const s=fixture(n);s.roleCards[2]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'builder-choice',actorId:s.seatOrder[actorIndex]!,roleChooserId:s.seatOrder[0]!,actorIndex};
  return s;
}
function quarries(s:ReturnType<typeof builder>,count:number) {
  for(let i=1;i<=count;i++)s.players[0]!.countryside.push({instanceId:createId('tile',`quarry-${i}`),kind:'quarry',occupied:true});
  s.supply.quarryCount-=count;s.supply.workerCount-=count;
}
function own(s:ReturnType<typeof builder>,index:number,type:BuildingType,occupiedSlots=0) {
  s.supply.buildingStock[type]--;s.supply.workerCount-=occupiedSlots;
  s.players[index]!.buildings.push({instanceId:createId('building',`owned-${index}-${type}`),buildingTypeId:type,occupiedSlots});
}
const build=(s:GameState,purchase:unknown,actorId=s.phase.kind==='builder-choice'?s.phase.actorId:s.seatOrder[0]!)=>
  applyCommand(s,{kind:'build',actorId,purchase} as GameCommand);
function freeze(value: unknown): void {
  if(value && typeof value==='object') {for(const child of Object.values(value))freeze(child);Object.freeze(value);}
}
function city(s:ReturnType<typeof builder>,spaces:number) {
  const types:BuildingType[]=['small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill',
    'large-tobacco-storage','large-coffee-roaster','small-market','hacienda','builders-yard','small-warehouse','hospital'];
  for(const type of types.slice(0,spaces))own(s,0,type);
}

it('BLD-01: Office price is 2 with accepted chooser discount and 3 if declined',()=>{
  const s=builder();quarries(s,3);s.players[0]!.coins=5;assertGameState(s);
  const legal=getLegalCommands(s,s.seatOrder[0]!)[0];
  expect(legal?.phase).toBe('builder-choice');if(legal?.phase!=='builder-choice')return;
  expect(legal.purchases.filter(p=>p.buildingTypeId==='office')).toEqual([
    {buildingTypeId:'office',useAdvantage:false,price:3,schoolChoices:[false]},
    {buildingTypeId:'office',useAdvantage:true,price:2,schoolChoices:[false]},
  ]);
  expect(getLegalCommands(s,s.seatOrder[1]!)).toEqual([]);
});

it.each([
  ['builders-yard',1],['office',3],['harbor',5],['city-hall',7],
] as const)('BLD-01: occupied Quarries cap %s at price %i before the chooser discount',(type,price)=>{
  const s=builder();quarries(s,3);s.players[0]!.coins=10;
  const descriptor=getLegalCommands(s,s.seatOrder[0]!)[0];if(descriptor?.phase!=='builder-choice')throw Error('fixture');
  expect(descriptor.purchases.find(x=>x.buildingTypeId===type && !x.useAdvantage)).toEqual({
    buildingTypeId:type,useAdvantage:false,price,schoolChoices:[false],
  });
});

it.each([true,false])('BLD-01: buying Office with chooser discount %s pays the exact price',useAdvantage=>{
  const s=builder();quarries(s,3);s.players[0]!.coins=5;const before=JSON.stringify(s);freeze(s);
  const result=build(s,{buildingTypeId:'office',useAdvantage,useSchool:false});if(!result.ok)throw Error(result.error.message);
  const paid=useAdvantage?2:3;const built={instanceId:createId('building','building-office-1'),buildingTypeId:'office',occupiedSlots:0};
  expect(result.state).toEqual({...s,revision:2,
    players:s.players.map((p,i)=>i===0?{...p,coins:5-paid,buildings:[...p.buildings,built]}:p),
    supply:{...s.supply,buildingStock:{...s.supply.buildingStock,office:1}},
    phase:{kind:'builder-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1},
  });
  expect(result.events).toEqual([
    {kind:'building-built',revision:2,index:0,playerId:s.seatOrder[0],building:built},
    {kind:'coins-changed',revision:2,index:1,playerId:s.seatOrder[0],delta:-paid},
    {kind:'phase-changed',revision:2,index:2,from:'builder-choice',to:'builder-choice'},
  ]);
  expect(result.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('BUILDER-002: discounts floor at zero without paying coins to the chooser',()=>{
  const s=builder();quarries(s,1);s.players[0]!.coins=0;
  const options=getLegalCommands(s,s.seatOrder[0]!)[0];if(options?.phase!=='builder-choice')throw Error('fixture');
  expect(options.purchases.filter(p=>p.buildingTypeId==='small-fruit-depot')).toEqual([
    {buildingTypeId:'small-fruit-depot',useAdvantage:false,price:0,schoolChoices:[false]},
    {buildingTypeId:'small-fruit-depot',useAdvantage:true,price:0,schoolChoices:[false]},
  ]);
  const result=build(s,{buildingTypeId:'small-fruit-depot',useAdvantage:true,useSchool:false});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.coins).toBe(0);
  expect(result.events.map(event=>event.kind)).toEqual(['building-built','phase-changed']);assertGameState(result.state);
});

it('BUILDER-001: declining buys nothing and pays no privilege bonus',()=>{
  const s=builder();const before=JSON.stringify(s);freeze(s);
  const result=build(s,null);if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,revision:2,phase:{kind:'builder-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1}});
  expect(result.events).toEqual([{kind:'phase-changed',revision:2,index:0,from:'builder-choice',to:'builder-choice'}]);
  expect(JSON.stringify(s)).toBe(before);
});

it('BUILDER-001: nonchooser cannot claim the chooser discount',()=>{
  const s=builder(3,1);s.players[1]!.coins=5;
  const descriptor=getLegalCommands(s,s.seatOrder[1]!)[0];if(descriptor?.phase!=='builder-choice')throw Error('fixture');
  expect(descriptor.purchases.filter(x=>x.buildingTypeId==='office')).toEqual([
    {buildingTypeId:'office',useAdvantage:false,price:5,schoolChoices:[false]},
  ]);
  expect(build(s,{buildingTypeId:'office',useAdvantage:true,useSchool:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});

it('BLD-02: at City footprint 10 a two-space building triggers the end while B and C may act',()=>{
  const s=builder();city(s,10);s.players[0]!.coins=10;assertGameState(s);
  const result=build(s,{buildingTypeId:'fire-station',useAdvantage:false,useSchool:false});if(!result.ok)throw Error(result.error.message);
  const trigger={reason:'city-full',role:'builder',playerId:s.seatOrder[0]!,triggeringRevision:2,completion:'phase-completion'};
  expect(result.state.endTriggers).toEqual([trigger]);
  expect(result.state.players[0]!.buildings.at(-1)).toMatchObject({buildingTypeId:'fire-station',occupiedSlots:0});
  expect(result.state.phase).toEqual({kind:'builder-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1});
  expect(result.events.map(e=>[e.kind,e.revision,e.index])).toEqual([
    ['building-built',2,0],['coins-changed',2,1],['end-triggered',2,2],['phase-changed',2,3],
  ]);
  expect(result.events[2]).toMatchObject({kind:'end-triggered',trigger});
  expect(getLegalCommands(result.state,s.seatOrder[1]!)[0]).toMatchObject({phase:'builder-choice',actorId:s.seatOrder[1]});
  assertGameState(result.state);
});

it('BLD-02: at footprint 11 a two-space building is rejected but a one-space buy triggers',()=>{
  const s=builder();city(s,11);s.players[0]!.coins=10;assertGameState(s);
  const before=JSON.stringify(s);freeze(s);
  expect(build(s,{buildingTypeId:'fire-station',useAdvantage:false,useSchool:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(JSON.stringify(s)).toBe(before);
  const one=build(s,{buildingTypeId:'large-warehouse',useAdvantage:false,useSchool:false});if(!one.ok)throw Error(one.error.message);
  expect(one.state.endTriggers).toEqual([{reason:'city-full',role:'builder',playerId:s.seatOrder[0],triggeringRevision:2,completion:'phase-completion'}]);
  assertGameState(one.state);
});

it('BUILDER-001: an ordinary Wharf purchase creates an empty Personal Ship but cannot charter',()=>{
  const s=builder();s.players[0]!.coins=9;
  const result=build(s,{buildingTypeId:'wharf',useAdvantage:false,useSchool:false});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.personalShip).toEqual({goodType:null,loadedCount:0,usedThisPhase:false});
  expect(result.state.players[0]!.buildings.at(-1)?.occupiedSlots).toBe(0);
  expect(result.state.supply.buildingStock.wharf).toBe(1);assertGameState(result.state);
});

it('BUILDER-003: School is optional and preserves the input',()=>{
  const s=builder();own(s,0,'school',1);s.players[0]!.coins=10;assertGameState(s);
  const before=JSON.stringify(s);freeze(s);
  expect(build(s,{buildingTypeId:'large-fruit-depot',useAdvantage:false,useSchool:true})).toMatchObject({ok:true,state:{players:expect.arrayContaining([expect.objectContaining({playerId:s.seatOrder[0],buildings:expect.arrayContaining([expect.objectContaining({buildingTypeId:'large-fruit-depot',occupiedSlots:1})])})])}});
  expect(JSON.stringify(s)).toBe(before);
  const result=build(s,{buildingTypeId:'large-fruit-depot',useAdvantage:false,useSchool:false});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.buildings.at(-1)?.occupiedSlots).toBe(0);assertGameState(result.state);
});

it('BUILDER-001: only affordable and in-stock types are offered; owned types cannot be repurchased',()=>{
  const s=builder();own(s,0,'office');s.players[0]!.coins=2;assertGameState(s);
  const descriptor=getLegalCommands(s,s.seatOrder[0]!)[0];if(descriptor?.phase!=='builder-choice')throw Error('fixture');
  expect(descriptor.purchases.some(x=>x.buildingTypeId==='office')).toBe(false);
  expect(descriptor.purchases.some(x=>x.buildingTypeId==='fire-station')).toBe(false);
  expect(descriptor.purchases.some(x=>x.buildingTypeId==='small-market')).toBe(true);
  expect(build(s,{buildingTypeId:'office',useAdvantage:true,useSchool:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});

it('BUILDER-001: exhausted stock is unavailable even when affordable',()=>{
  const s=builder();own(s,1,'office');own(s,2,'office');s.players[0]!.coins=10;assertGameState(s);
  const descriptor=getLegalCommands(s,s.seatOrder[0]!)[0];if(descriptor?.phase!=='builder-choice')throw Error('fixture');
  expect(descriptor.purchases.some(p=>p.buildingTypeId==='office')).toBe(false);
  expect(build(s,{buildingTypeId:'office',useAdvantage:false,useSchool:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});

it('BUILDER-001: insufficient funds with no discount reject without mutation',()=>{
  const s=builder(3,1);s.players[1]!.coins=4;const before=JSON.stringify(s);freeze(s);
  expect(build(s,{buildingTypeId:'office',useAdvantage:false,useSchool:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(JSON.stringify(s)).toBe(before);
});

it.each([null,undefined,{},[],{buildingTypeId:'office'},
  {buildingTypeId:'office',useAdvantage:false,useSchool:false,price:0},
  {buildingTypeId:'not-a-building',useAdvantage:false,useSchool:false},
  {buildingTypeId:'office',useAdvantage:1,useSchool:false},
  {buildingTypeId:'office',useAdvantage:false,useSchool:true},
])('BUILDER-001: malformed purchase %# is rejected or is a valid decline',purchase=>{
  const s=builder();s.players[0]!.coins=10;const before=JSON.stringify(s);freeze(s);
  const result=build(s,purchase);
  if(purchase===null)expect(result.ok).toBe(true);
  else {
    expect(result).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
    expect(result).not.toHaveProperty('state');expect(result).not.toHaveProperty('events');
    expect(JSON.stringify(s)).toBe(before);expect(build(s,purchase)).toEqual(result);
  }
});

it('BUILDER-001: actor with no affordable purchases auto-skips without a fake pass command',()=>{
  const s=builder(3,1);s.players[1]!.coins=0;s.players[2]!.coins=0;
  const options=getLegalCommands(s,s.seatOrder[1]!)[0];
  expect(options).toEqual({phase:'builder-choice',actorId:s.seatOrder[1],canDecline:true,purchases:[]});
  const before=JSON.stringify(s);freeze(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,revision:1,roleSelectionIndex:1,phase:{kind:'role-selection',actorId:s.seatOrder[1]}});
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'builder-choice',to:'builder-choice'},
    {kind:'phase-changed',revision:1,index:1,from:'builder-choice',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:2,from:'phase-completion',to:'role-selection'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('BUILDER-002: zero coins do not auto-skip an available free chooser purchase',()=>{
  const s=builder();s.players[0]!.coins=0;
  const result=advanceAutomatic({ok:true,state:s,events:[]});
  expect(result).toEqual({ok:true,state:s,events:[]});
  expect(getLegalCommands(s,s.seatOrder[0]!)[0]).toMatchObject({phase:'builder-choice',canDecline:true});
  const offers=getLegalCommands(s,s.seatOrder[0]!)[0];if(offers?.phase!=='builder-choice')throw Error('fixture');
  expect(offers.purchases).toContainEqual({buildingTypeId:'small-market',useAdvantage:true,price:0,schoolChoices:[false]});
});

it.each([3,4,5])('ROUND-002: final Builder actor declines and the next round starts for %i players',n=>{
  const s=builder(n);s.roleSelectionIndex=n-1;s.roleCards[2]!.selectedBy=s.seatOrder[n-1]!;
  const other=s.roleCards.filter(card=>card.kind!=='builder');
  for(let i=0;i<n-1;i++)other[i]!.selectedBy=s.seatOrder[i]!;
  s.phase={kind:'builder-choice',actorId:s.seatOrder[n-2]!,roleChooserId:s.seatOrder[n-1]!,actorIndex:n-1};
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  const result=build(s,null);if(!result.ok)throw Error(result.error.message);
  expect(result.state.roundNumber).toBe(2);expect(result.state.governorPlayerId).toBe(s.seatOrder[1]);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.roleSelectionIndex).toBe(0);expect(result.state.roleCards.filter(r=>r.selectedBy!==null)).toEqual([]);
  expect(result.state.roleCards.filter((r,i)=>s.roleCards[i]!.selectedBy===null).map(r=>r.accumulatedCoins)).toEqual([1,1,1]);
  expect(result.state.revision).toBe(2);expect(result.state.rng).toEqual(s.rng);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:2,index:0,from:'builder-choice',to:'phase-completion'},
    {kind:'phase-changed',revision:2,index:1,from:'phase-completion',to:'round-completion'},
    {kind:'phase-changed',revision:2,index:2,from:'round-completion',to:'role-selection'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('BUILDER-003: later actors retain their purchase decisions after a City trigger',()=>{
  const s=builder();city(s,10);s.players[0]!.coins=10;
  const a=build(s,{buildingTypeId:'fire-station',useAdvantage:false,useSchool:false});if(!a.ok)throw Error(a.error.message);
  const b=build(a.state,{buildingTypeId:'small-fruit-depot',useAdvantage:false,useSchool:false});if(!b.ok)throw Error(b.error.message);
  expect(b.state.phase).toEqual({kind:'builder-choice',actorId:s.seatOrder[2],roleChooserId:s.seatOrder[0],actorIndex:2});
  expect(b.state.players[1]!.coins).toBe(1);
  expect(b.state.endTriggers).toEqual(a.state.endTriggers);
  expect(b.events).toEqual([
    {kind:'building-built',revision:3,index:0,playerId:s.seatOrder[1],building:b.state.players[1]!.buildings[0]},
    {kind:'coins-changed',revision:3,index:1,playerId:s.seatOrder[1],delta:-1},
    {kind:'phase-changed',revision:3,index:2,from:'builder-choice',to:'builder-choice'},
  ]);
  assertGameState(b.state);
});

// AUD-06 user ruling (2026-10-01): after a City-full trigger, actors with no affordable building are
// skipped automatically, exactly as before the trigger; the phase still completes before scoring.
it('BLD-02: after a full City, actors with nothing affordable are skipped and the game ends',()=>{
  const s=builder();city(s,10);s.players[0]!.coins=10;s.players[1]!.coins=0;s.players[2]!.coins=0;
  const a=build(s,{buildingTypeId:'fire-station',useAdvantage:false,useSchool:false});if(!a.ok)throw Error(a.error.message);
  expect(a.state.phase).toEqual({kind:'game-over',scores:calculateFinalScore(a.state)});
  expect(a.state.endTriggers.map(t=>t.reason)).toEqual(['city-full']);
  expect(a.state.roundNumber).toBe(1);expect(a.state.roleSelectionIndex).toBe(0);
  // One revision: the build, the automatic skips to completion, game over and scoring.
  expect(a.events.slice(-2)).toEqual([{kind:'phase-changed',revision:2,index:a.events.length-2,from:'phase-completion',to:'game-over'},
    {kind:'game-scored',revision:2,index:a.events.length-1,scores:calculateFinalScore(a.state)}]);
  expect(getLegalCommands(a.state,s.seatOrder[1]!)).toEqual([]);
  assertGameState(a.state);
});

it('BLD-02: after a full City, an actor who can afford a building still decides; the rest are skipped',()=>{
  const s=builder();city(s,10);s.players[0]!.coins=10;s.players[1]!.coins=1;s.players[2]!.coins=0;
  const a=build(s,{buildingTypeId:'fire-station',useAdvantage:false,useSchool:false});if(!a.ok)throw Error(a.error.message);
  expect(a.state.phase).toEqual({kind:'builder-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1});
  const b=build(a.state,null);if(!b.ok)throw Error(b.error.message);
  // C cannot afford anything, so the declined turn moves straight to phase completion and scoring.
  expect(b.state.phase).toEqual({kind:'game-over',scores:calculateFinalScore(b.state)});
  expect(b.state.endTriggers).toEqual(a.state.endTriggers);
  expect(advanceAutomatic(b)).toEqual(b);
  assertGameState(b.state);
});

it('BUILDER-001: an instance ID collision in a valid restored state does not duplicate a tile',()=>{
  const s=builder();s.players[0]!.coins=5;s.estateMarket[0]!.instanceId=createId('tile','building-office-1');
  assertGameState(s);
  const result=build(s,{buildingTypeId:'office',useAdvantage:false,useSchool:false});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.buildings[0]?.instanceId).toBe('building-office-2');assertGameState(result.state);
});

it('BUILDER-001: wrong actor and wrong phase cannot purchase',()=>{
  const s=builder();s.players[0]!.coins=10;const purchase={buildingTypeId:'office',useAdvantage:false,useSchool:false} as const;
  expect(build(s,purchase,s.seatOrder[1]!)).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
  s.phase={kind:'role-selection',actorId:s.seatOrder[0]!};s.roleCards[2]!.selectedBy=null;
  expect(build(s,purchase,s.seatOrder[0]!)).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
