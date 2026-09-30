import { expect, it } from 'vitest';
import { createGame, createId, RULESET, assertGameState, serializeGame, deserializeGame } from '../src/index.js';
import type { CreateGameInput } from '../src/index.js';
function input(n:number):CreateGameInput {
  const seatOrder=Array.from({length:n},(_,i)=>createId('player',`p${i}`));
  return {rulesetId:RULESET.id,gameId:createId('game','setup-test'),seatOrder,governorPlayerId:seatOrder[0]!,seed:0};
}
it.each([
  {n:3,coins:2,workers:55,register:3,total:58,vp:75,capacities:[4,5,6],roles:6,adventurers:0,estates:['fruit','fruit','corn']},
  {n:4,coins:3,workers:75,register:4,total:79,vp:100,capacities:[5,6,7],roles:7,adventurers:1,estates:['fruit','fruit','corn','corn']},
  {n:5,coins:4,workers:95,register:5,total:100,vp:126,capacities:[6,7,8],roles:8,adventurers:2,estates:['fruit','fruit','fruit','corn','corn']},
])('creates the exact $n-player configuration',v=>{
  const result=createGame(input(v.n));expect(result.ok).toBe(true);if(!result.ok)return;
  const s=result.state;assertGameState(s);
  expect(s.players.map(p=>p.coins)).toEqual(Array(v.n).fill(v.coins));
  expect(s.players.map(p=>p.countryside[0]!.kind)).toEqual(v.estates);
  for(const p of s.players){expect(p.countryside[0]!.occupied).toBe(false);expect(p.buildings).toEqual([]);expect(p.idleWorkerCount).toBe(0);expect(p.earnedVp).toBe(0);expect(p.personalShip).toBeNull();expect(Object.values(p.goods)).toEqual([0,0,0,0,0]);}
  expect(s.supply.workerCount).toBe(v.workers);expect(s.supply.workRegisterCount).toBe(v.register);
  expect(s.supply.workerCount+s.supply.workRegisterCount).toBe(v.total);expect(s.supply.vpRemaining).toBe(v.vp);expect(s.supply.vpOverflow).toBe(0);
  expect(s.ships.map(x=>x.capacity)).toEqual(v.capacities);expect(s.ships.every(x=>x.goodType===null&&x.loadedCount===0)).toBe(true);
  expect(s.roleCards).toHaveLength(v.roles);expect(s.roleCards.filter(r=>r.kind==='adventurer')).toHaveLength(v.adventurers);
  expect(new Set(s.roleCards.map(r=>r.instanceId)).size).toBe(v.roles);expect(s.roleCards.every(r=>r.selectedBy===null&&r.accumulatedCoins===0)).toBe(true);
  expect(s.supply.goods).toEqual({corn:10,fruit:11,sugar:11,tobacco:9,coffee:9});expect(s.supply.quarryCount).toBe(8);
  expect(Object.values(s.supply.buildingStock).reduce((a,b)=>a+b,0)).toBe(49);
  expect(s.estateMarket).toHaveLength(v.n+1);expect(s.estateBag).toHaveLength(49-2*v.n);
  expect(s.estateDiscard).toEqual([]);expect(s.tradingHouse).toEqual([]);expect(s.endTriggers).toEqual([]);
  expect(s.revision).toBe(0);expect(s.roundNumber).toBe(1);expect(s.roleSelectionIndex).toBe(0);
  expect(s.phase).toEqual({kind:'role-selection',actorId:s.governorPlayerId});expect(result.events).toEqual([]);
  expect(deserializeGame(serializeGame(s))).toEqual(s);
});
it('is deterministic, consumes no extra setup draws, and draws market before starting tiles',()=>{
  const args=input(3);Object.freeze(args.seatOrder);Object.freeze(args);
  const first=createGame(args);expect(first).toEqual(createGame(args));if(!first.ok)return;
  // Independent Python xoshiro/SplitMix/Fisher–Yates reference, seed0; PR-007 algorithm.
  expect(first.state.estateMarket.map(t=>t.instanceId)).toEqual(['estate-tobacco-4','estate-sugar-6','estate-corn-2','estate-sugar-4']);
  expect(first.state.players.map(p=>p.countryside[0]!.instanceId)).toEqual(['estate-fruit-5','estate-fruit-10','estate-corn-1']);
  expect(first.state.rng.state).toEqual([3455446667,1490379829,1062487765,1988381679]);
  const second=createGame(args);if(!second.ok)return;
  expect(second.state.supply.goods).not.toBe(first.state.supply.goods);
  expect(second.state.supply.buildingStock).not.toBe(first.state.supply.buildingStock);
  expect(second.state.players[0]!.goods).not.toBe(second.state.players[1]!.goods);
  expect(createGame({...args,seed:1})).not.toEqual(first);
});
it('assigns starting types clockwise from a nonfirst Governor without changing seats',()=>{
  const args=input(5);const result=createGame({...args,governorPlayerId:args.seatOrder[3]!});if(!result.ok)throw Error(result.error.message);
  expect(result.state.seatOrder).toEqual(args.seatOrder);
  expect(result.state.players.map(p=>p.countryside[0]!.kind)).toEqual(['fruit','corn','corn','fruit','fruit']);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:args.seatOrder[3]});assertGameState(result.state);
});
it.each([0,1,2,6])('rejects unsupported player count %i',n=>{expect(createGame(input(n))).toMatchObject({ok:false,error:{code:'INVALID_SETUP'}});});
it.each([
  {seatOrder:[createId('player','p0'),createId('player','p0'),createId('player','p2')]},
  {governorPlayerId:createId('player','missing')}, {seed:-1}, {seed:1.5}, {seed:NaN}, {seed:4294967296},
])('rejects invalid input %#',change=>{expect(createGame({...input(3),...change})).toMatchObject({ok:false,error:{code:'INVALID_SETUP'}});});
it('rejects unsupported rulesets and malformed IDs',()=>{
  expect(createGame({...input(3),rulesetId:'classic'} as unknown as CreateGameInput)).toMatchObject({ok:false,error:{code:'UNSUPPORTED_RULESET'}});
  expect(createGame({...input(3),gameId:''} as unknown as CreateGameInput)).toMatchObject({ok:false,error:{code:'INVALID_SETUP'}});
});
it.each([null,undefined,[],{...input(3),seatOrder:null},{...input(3),seatOrder:['p0',,'p2']},{...input(3),seatOrder:['p0',' ','p2']}])('rejects malformed setup boundary %#',value=>{
  expect(createGame(value as unknown as CreateGameInput)).toMatchObject({ok:false,error:{code:'INVALID_SETUP'}});
});
