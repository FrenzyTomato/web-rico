import { expect, it } from 'vitest';
import { applyCommand, assertGameState, seedRng, serializeGame, deserializeGame } from '../../src/index.js';
import type { Good } from '../../src/index.js';
import { advanceAutomatic } from '../../src/round/advanceAutomatic.js';
import { fixture } from '../helpers/state.js';

function lastActor(n=5) {
  const s=fixture(n);s.roleCards[0]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'planter-worker',actorId:s.seatOrder[n-1]!,roleChooserId:s.seatOrder[0]!,actorIndex:n-1,acquiredTileIds:[]};
  return s;
}
function freeze(value: unknown): void {
  if(value && typeof value==='object') {for(const child of Object.values(value))freeze(child);Object.freeze(value);}
}
function take(tiles: ReturnType<typeof fixture>['estateBag'],kind:Good) {
  const index=tiles.findIndex(tile=>tile.kind===kind);
  return tiles.splice(index,1)[0]!;
}

it.each([3,4,5])('PLANTER-003: refills the market from bag and advances the next chooser for %i players',n=>{
  const s=fixture(n);s.roleCards[0]!.selectedBy=s.seatOrder[0]!;
  s.phase={kind:'planter-worker',actorId:s.seatOrder[n-1]!,roleChooserId:s.seatOrder[0]!,actorIndex:n-1,acquiredTileIds:[]};
  const oldMarket=[...s.estateMarket];const oldBag=[...s.estateBag];const rng=s.rng;
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual(oldBag.slice(0,n+1));
  expect(result.state.estateBag).toEqual(oldBag.slice(n+1));
  expect(result.state.estateDiscard).toEqual(oldMarket);
  expect(result.state.rng).toEqual(rng);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.revision).toBe(1);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:1,from:'phase-completion',to:'role-selection'},
  ]);
  assertGameState(result.state);
});

it('PLN-02: draws bag first, then shuffles old discards and leftover market to refill six tiles',()=>{
  const s=lastActor();const tiles=[...s.estateBag,...s.estateMarket];
  s.estateBag=[take(tiles,'corn')];
  s.estateDiscard=[take(tiles,'tobacco'),take(tiles,'coffee'),take(tiles,'fruit')];
  s.estateMarket=[take(tiles,'fruit'),take(tiles,'sugar')];
  for(let i=0;i<tiles.length;i++)s.players[i%5]!.countryside.push({...tiles[i]!,occupied:false});
  s.rng=seedRng(111) as typeof s.rng;
  const expected=[s.estateBag[0],s.estateMarket[0],s.estateMarket[1],...s.estateDiscard];
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  const previous={kind:'phase-changed',revision:1,index:0,from:'planter-choice',to:'planter-worker'} as const;
  const result=advanceAutomatic({ok:true,state:s,events:[previous]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual([expected[0],expected[1],expected[2],expected[3],expected[4],expected[5]]);
  expect(result.state.estateMarket.map(tile=>tile.kind)).toEqual(['corn','fruit','sugar','tobacco','coffee','fruit']);
  expect(result.state.estateBag).toEqual([]);expect(result.state.estateDiscard).toEqual([]);
  expect(result.state.rng.state).toEqual([3991455484,1086593758,3533621848,1480283464]);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.events).toEqual([previous,
    {kind:'phase-changed',revision:1,index:1,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:2,from:'phase-completion',to:'role-selection'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
  expect(deserializeGame(serializeGame(result.state))).toEqual(result.state);
  expect(advanceAutomatic(result)).toEqual(result);
});

it.each([2,0])('PLANTER-003: market contains only %i tiles when all other estates are placed',remaining=>{
  const s=lastActor();const tiles=[...s.estateBag,...s.estateMarket];
  s.estateMarket=[];s.estateBag=tiles.splice(0,remaining);
  for(let i=0;i<tiles.length;i++)s.players[i%5]!.countryside.push({...tiles[i]!,occupied:false});
  assertGameState(s);const before=JSON.stringify(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual(s.estateBag);
  expect(result.state.estateMarket).toHaveLength(remaining);
  expect(result.state.estateBag).toEqual([]);expect(result.state.estateDiscard).toEqual([]);
  expect(result.state.rng).toEqual(s.rng);expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('PLANTER-003: recycles only two leftover market tiles when the hidden bag is empty',()=>{
  const s=lastActor();const tiles=[...s.estateBag,...s.estateMarket];
  s.estateBag=[];s.estateMarket=[take(tiles,'fruit'),take(tiles,'sugar')];
  for(let i=0;i<tiles.length;i++)s.players[i%5]!.countryside.push({...tiles[i]!,occupied:false});
  s.rng=seedRng(111) as typeof s.rng;
  assertGameState(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual(s.estateMarket);
  expect(result.state.estateMarket).toHaveLength(2);
  expect(result.state.estateBag).toEqual([]);expect(result.state.estateDiscard).toEqual([]);
  expect(result.state.rng.state).toEqual([4078909783,196318731,2652759060,3251696593]);
  assertGameState(result.state);
});

it('PLANTER-003: does not reshuffle discards after an exact bag draw',()=>{
  const s=lastActor();const tiles=[...s.estateBag,...s.estateMarket];
  s.estateBag=tiles.splice(0,6);s.estateDiscard=[tiles.pop()!];s.estateMarket=tiles.splice(0,2);
  for(let i=0;i<tiles.length;i++)s.players[i%5]!.countryside.push({...tiles[i]!,occupied:false});
  assertGameState(s);const before=JSON.stringify(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual(s.estateBag);
  expect(result.state.estateBag).toEqual([]);
  expect(result.state.estateDiscard).toEqual([...s.estateDiscard,...s.estateMarket]);
  expect(result.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);
});

it.each([3,4,5])('ROUND-002: final Planter role refills before rotating Governor for %i players',n=>{
  const s=fixture(n);s.roleSelectionIndex=n-1;s.roleCards[0]!.selectedBy=s.seatOrder[n-1]!;
  for(let i=1;i<n;i++)s.roleCards[i]!.selectedBy=s.seatOrder[i-1]!;
  let extra=0;for(const card of s.roleCards)if(card.selectedBy===null)card.accumulatedCoins=[0,2,4][extra++]!;
  s.phase={kind:'planter-worker',actorId:s.seatOrder[n-2]!,roleChooserId:s.seatOrder[n-1]!,actorIndex:n-1,acquiredTileIds:[]};
  assertGameState(s);const market=s.estateBag.slice(0,n+1);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.estateMarket).toEqual(market);
  expect(result.state.roundNumber).toBe(2);expect(result.state.governorPlayerId).toBe(s.seatOrder[1]);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.roleSelectionIndex).toBe(0);
  expect(result.state.roleCards.filter((card,i)=>s.roleCards[i]!.selectedBy===null).map(card=>card.accumulatedCoins)).toEqual([1,3,5]);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:1,from:'phase-completion',to:'round-completion'},
    {kind:'phase-changed',revision:1,index:2,from:'round-completion',to:'role-selection'},
  ]);
  assertGameState(result.state);
});

it('PLANTER-003: last actor declines and completion stays in the same command revision',()=>{
  const s=lastActor(3);
  s.phase={kind:'planter-choice',actorId:s.seatOrder[2]!,roleChooserId:s.seatOrder[0]!,actorIndex:2,acquiredTileIds:[]};
  const oldMarket=[...s.estateMarket];const before=JSON.stringify(s);freeze(s);
  const result=applyCommand(s,{kind:'plant',actorId:s.seatOrder[2]!,choice:{kind:'decline'}});
  if(!result.ok)throw Error(result.error.message);
  expect(result.state.revision).toBe(2);expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.estateMarket).toEqual(s.estateBag.slice(0,4));expect(result.state.estateDiscard).toEqual(oldMarket);
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:2,index:0,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:2,index:1,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:2,index:2,from:'phase-completion',to:'role-selection'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('PLANTER-003: final actor with no tile choices needs no invented decline command',()=>{
  const s=lastActor(3);s.estateBag.push(...s.estateMarket);s.estateMarket=[];s.supply.quarryCount=0;
  for(let i=1;i<=8;i++)s.players[0]!.countryside.push({instanceId:`quarry-${i}` as typeof s.players[0]['countryside'][number]['instanceId'],kind:'quarry',occupied:false});
  s.phase={kind:'planter-choice',actorId:s.seatOrder[2]!,roleChooserId:s.seatOrder[0]!,actorIndex:2,acquiredTileIds:[]};
  assertGameState(s);
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:1,index:0,from:'planter-choice',to:'planter-worker'},
    {kind:'phase-changed',revision:1,index:1,from:'planter-worker',to:'phase-completion'},
    {kind:'phase-changed',revision:1,index:2,from:'phase-completion',to:'role-selection'},
  ]);
  assertGameState(result.state);
});
