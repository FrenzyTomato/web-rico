import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands } from '../../src/index.js';
import type { GameCommand, GameState } from '../../src/index.js';
import { advanceAutomatic } from '../../src/round/advanceAutomatic.js';
import { fixture } from '../helpers/state.js';

function planter(n=3, actorIndex=0) {
  const s=fixture(n);s.roleCards[0]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'planter-choice',actorId:s.seatOrder[actorIndex]!,roleChooserId:s.seatOrder[0]!,actorIndex,acquiredTileIds:[]};
  return s;
}
function freeze(value: unknown): void {
  if(value && typeof value==='object') { for(const child of Object.values(value)) freeze(child);Object.freeze(value); }
}
const plant=(s:GameState,choice:unknown,actorId=s.phase.kind==='planter-choice'?s.phase.actorId:s.seatOrder[0]!)=>
  applyCommand(s,{kind:'plant',actorId,choice} as GameCommand);
function addYard(s:ReturnType<typeof planter>,occupiedSlots:number) {
  s.supply.buildingStock['builders-yard']--;
  s.supply.workerCount-=occupiedSlots;
  s.players[1]!.buildings.push({instanceId:createId('building','yard'),buildingTypeId:'builders-yard',occupiedSlots});
}

it('PLANTER-001: lists face-up estates and the chooser Quarry with an explicit decline',()=>{
  const s=fixture();s.roleCards[0]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'planter-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0,acquiredTileIds:[]};
  expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'planter-choice',actorId:s.seatOrder[0],choices:[
    ...s.estateMarket.map(tile=>({kind:'estate',tileId:tile.instanceId})),{kind:'quarry'},{kind:'decline'},
  ]}]);
  expect(getLegalCommands(s,s.seatOrder[1]!)).toEqual([]);
});

it('PLN-01: Quarry at 11 spaces uses the last Quarry and advances to the next actor',()=>{
  const s=planter();s.players[0]!.countryside.push(...s.estateBag.splice(0,10).map(tile=>({...tile,occupied:false})));
  s.supply.quarryCount=1;
  for(let i=1;i<=7;i++)s.players[1]!.countryside.push({instanceId:createId('tile',`quarry-${i}`),kind:'quarry',occupied:false});
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  const result=plant(s,{kind:'quarry'});if(!result.ok)throw Error(result.error.message);
  const quarry={instanceId:createId('tile','quarry-8'),kind:'quarry',occupied:false};
  expect(result.state).toEqual({...s,revision:2,supply:{...s.supply,quarryCount:0},
    players:s.players.map((p,i)=>i===0?{...p,countryside:[...p.countryside,quarry]}:p),
    phase:{kind:'planter-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,acquiredTileIds:[]},
  });
  expect(result.events).toEqual([
    {kind:'tile-placed',revision:2,index:0,playerId:s.seatOrder[0],tile:quarry},
    {kind:'phase-changed',revision:2,index:1,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:2,index:2,from:'planter-worker',to:'planter-before'},
    {kind:'phase-changed',revision:2,index:3,from:'planter-before',to:'planter-choice'},
  ]);
  expect(result.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
  expect(getLegalCommands(result.state,s.seatOrder[1]!)).toEqual([{phase:'planter-choice',actorId:s.seatOrder[1],
    choices:[...s.estateMarket.map(tile=>({kind:'estate',tileId:tile.instanceId})),{kind:'decline'}]}]);
  expect(plant(result.state,{kind:'quarry'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'PLANTER-001'}});
});

it.each([3,4,5])('PLANTER-001: selecting one face-up estate removes only that instance for %i players',n=>{
  const s=planter(n);const tile=s.estateMarket[1]!;const oldMarket=[...s.estateMarket];const before=JSON.stringify(s);freeze(s);
  const result=plant(s,{kind:'estate',tileId:tile.instanceId});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.countryside).toEqual([...s.players[0]!.countryside,{...tile,occupied:false}]);
  expect(result.state.estateMarket).toEqual(oldMarket.filter(x=>x.instanceId!==tile.instanceId));
  expect(result.state.estateBag).toEqual(s.estateBag);expect(result.state.supply.quarryCount).toBe(8);
  expect(result.state.revision).toBe(2);expect(result.state.rng).toEqual(s.rng);
  expect(result.events[0]).toEqual({kind:'tile-placed',revision:2,index:0,playerId:s.seatOrder[0],tile:{...tile,occupied:false}});
  expect(result.state.phase).toEqual({kind:'planter-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,acquiredTileIds:[]});
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it.each([0,1])('PLANTER-001: nonchooser Builder’s Yard with %i workers controls Quarry eligibility',occupiedSlots=>{
  const s=planter(4,1);addYard(s,occupiedSlots);assertGameState(s);
  const options=getLegalCommands(s,s.seatOrder[1]!)[0];
  expect(options?.phase).toBe('planter-choice');if(options?.phase!=='planter-choice')return;
  expect(options.choices.some(c=>c.kind==='quarry')).toBe(occupiedSlots===1);
  const before=JSON.stringify(s);freeze(s);
  const result=plant(s,{kind:'quarry'});
  if(!occupiedSlots)expect(result).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  else {
    if(!result.ok)throw Error(result.error.message);
    expect(result.state.players[1]!.countryside.at(-1)).toEqual({instanceId:createId('tile','quarry-1'),kind:'quarry',occupied:false});
    expect(result.state.supply.quarryCount).toBe(7);
    expect(result.state.phase).toEqual({kind:'planter-choice',actorId:s.seatOrder[2],roleChooserId:s.seatOrder[0],actorIndex:2,acquiredTileIds:[]});
    assertGameState(result.state);
  }
  expect(JSON.stringify(s)).toBe(before);
});

it('PLANTER-001: Quarry instance IDs remain unique across a valid restored state',()=>{
  const s=planter();s.estateMarket[0]!.instanceId=createId('tile','quarry-1');assertGameState(s);
  const result=plant(s,{kind:'quarry'});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.countryside.at(-1)!.instanceId).toBe('quarry-2');
  assertGameState(result.state);
});

it('PLANTER-001: declining the normal tile does not grant one or consume resources',()=>{
  const s=planter();const before=JSON.stringify(s);freeze(s);
  const result=plant(s,{kind:'decline'});if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,revision:2,
    phase:{kind:'planter-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,acquiredTileIds:[]},
  });
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:2,index:0,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:2,index:1,from:'planter-worker',to:'planter-before'},
    {kind:'phase-changed',revision:2,index:2,from:'planter-before',to:'planter-choice'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('PLANTER-001: full board only offers decline and never grants an extra tile',()=>{
  const s=planter();s.players[0]!.countryside.push(...s.estateBag.splice(0,11).map(tile=>({...tile,occupied:false})));
  assertGameState(s);const choices=getLegalCommands(s,s.seatOrder[0]!);
  expect(choices).toEqual([{phase:'planter-choice',actorId:s.seatOrder[0],choices:[{kind:'decline'}]}]);
  const before=JSON.stringify(s);freeze(s);
  expect(plant(s,{kind:'estate',tileId:s.estateMarket[0]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(plant(s,{kind:'quarry'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  const declined=plant(s,{kind:'decline'});expect(declined.ok).toBe(true);
  expect(JSON.stringify(s)).toBe(before);
});

it('PLANTER-001: automatically skips an earlier full-board actor without a fake player command',()=>{
  const s=planter();s.players[0]!.countryside.push(...s.estateBag.splice(0,11).map(tile=>({...tile,occupied:false})));
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'planter-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,acquiredTileIds:[]});
  expect(result.state.revision).toBe(1);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:1,index:1,from:'planter-worker',to:'planter-before'},
    {kind:'phase-changed',revision:1,index:2,from:'planter-before',to:'planter-choice'},
  ]);
  expect(JSON.stringify(s)).toBe(before);
});

it('PLANTER-001: role selection and forced skips share one revision and event batch',()=>{
  const s=fixture();s.players[0]!.countryside.push(...s.estateBag.splice(0,11).map(tile=>({...tile,occupied:false})));
  const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[0]!.instanceId});
  if(!result.ok)throw Error(result.error.message);
  expect(result.state.revision).toBe(2);
  expect(result.state.phase).toEqual({kind:'planter-choice',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,acquiredTileIds:[]});
  expect(result.events.map(e=>[e.kind,e.revision,e.index])).toEqual([
    ['role-selected',2,0],['phase-changed',2,1],['phase-changed',2,2],['phase-changed',2,3],
    ['phase-changed',2,4],['phase-changed',2,5],
  ]);
  assertGameState(result.state);
});

it('PLANTER-001: exhausted market and Quarry supply skip actors without a tile option',()=>{
  const s=planter();s.estateBag.push(...s.estateMarket);s.estateMarket=[];s.supply.quarryCount=0;
  for(let i=1;i<=8;i++)s.players[1]!.countryside.push({instanceId:createId('tile',`quarry-${i}`),kind:'quarry',occupied:false});
  assertGameState(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.events.map(e=>e.kind==='phase-changed'?[e.from,e.to]:e.kind)).toEqual([
    ['planter-choice','planter-worker'],['planter-worker','planter-before'],['planter-before','planter-choice'],
    ['planter-choice','planter-worker'],['planter-worker','planter-before'],['planter-before','planter-choice'],
    ['planter-choice','planter-worker'],['planter-worker','phase-completion'],['phase-completion','role-selection'],
  ]);
  expect(getLegalCommands(result.state,s.seatOrder[1]!)).toEqual([{phase:'role-selection',actorId:s.seatOrder[1],roleCardIds:s.roleCards.slice(1).map(card=>card.instanceId)}]);
});

it('PLANTER-001: no Quarry stock means no Quarry option even for the chooser',()=>{
  const s=planter();s.supply.quarryCount=0;
  for(let i=1;i<=8;i++)s.players[1]!.countryside.push({instanceId:createId('tile',`quarry-${i}`),kind:'quarry',occupied:false});
  assertGameState(s);
  expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'planter-choice',actorId:s.seatOrder[0],
    choices:[...s.estateMarket.map(tile=>({kind:'estate',tileId:tile.instanceId})),{kind:'decline'}]}]);
  expect(plant(s,{kind:'quarry'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});

it('PLANTER-001: exposed estate and Quarry remain available after hidden pools are exhausted',()=>{
  const s=planter(5);const tiles=[...s.estateBag,...s.estateMarket.splice(1)];s.estateBag=[];
  for(let i=0;i<tiles.length;i++)s.players[i%5]!.countryside.push({...tiles[i]!,occupied:false});
  assertGameState(s);expect(s.estateMarket).toHaveLength(1);
  const choices=getLegalCommands(s,s.seatOrder[0]!)[0];
  expect(choices).toEqual({phase:'planter-choice',actorId:s.seatOrder[0],choices:[
    {kind:'estate',tileId:s.estateMarket[0]!.instanceId},{kind:'quarry'},{kind:'decline'},
  ]});
  const estate=plant(s,{kind:'estate',tileId:s.estateMarket[0]!.instanceId});if(!estate.ok)throw Error(estate.error.message);
  expect(estate.state.estateMarket).toEqual([]);expect(estate.state.estateBag).toEqual([]);assertGameState(estate.state);
  const quarry=plant(s,{kind:'quarry'});if(!quarry.ok)throw Error(quarry.error.message);
  expect(quarry.state.supply.quarryCount).toBe(7);assertGameState(quarry.state);
});

it('PLANTER-002: an earlier Hacienda tile remains recorded for the Hospital decision',()=>{
  const s=planter(3,1);const acquired=s.players[1]!.countryside[0]!.instanceId;
  s.supply.buildingStock.hospital--;s.supply.workerCount--;
  s.players[1]!.buildings.push({instanceId:createId('building','hospital'),buildingTypeId:'hospital',occupiedSlots:1});
  if(s.phase.kind==='planter-choice')s.phase.acquiredTileIds=[acquired];
  const tile=s.estateMarket[0]!;
  const result=plant(s,{kind:'estate',tileId:tile.instanceId});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'planter-worker',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],
    actorIndex:1,acquiredTileIds:[acquired,tile.instanceId]});
  expect(result.events.map(e=>e.kind)).toEqual(['tile-placed','phase-changed']);
  expect(result.state.players[1]!.countryside).toHaveLength(2);assertGameState(result.state);
});

it('PLANTER-003: final actor decline completes Planter after market refill',()=>{
  const s=planter(3,2);
  const result=plant(s,{kind:'decline'});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.estateMarket).toEqual(s.estateBag.slice(0,4));
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:2,index:0,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:2,index:1,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:2,index:2,from:'phase-completion',to:'role-selection'},
  ]);
});

it.each([null,{},[],{kind:'estate'},{kind:'estate',tileId:'unknown'},
  {kind:'estate',tileId:42},{kind:'quarry',tileId:'extra'},{kind:'decline',tileId:'extra'},
  {kind:'other'},'decline'])('PLANTER-001: malformed or unavailable choice %j is rejected without mutation',choice=>{
  const s=planter();const before=JSON.stringify(s);freeze(s);
  const result=plant(s,choice);expect(result).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'PLANTER-001'}});
  expect(result).not.toHaveProperty('state');expect(result).not.toHaveProperty('events');
  expect(JSON.stringify(s)).toBe(before);expect(plant(s,choice)).toEqual(result);
});

it('PLANTER-001: rejects wrong actor and phase without touching state',()=>{
  const s=planter();const command={kind:'plant',actorId:s.seatOrder[1]!,choice:{kind:'decline'}} as const;
  expect(applyCommand(s,command)).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
  s.phase={kind:'planter-before',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};
  expect(applyCommand(s,{...command,actorId:s.seatOrder[0]!})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
