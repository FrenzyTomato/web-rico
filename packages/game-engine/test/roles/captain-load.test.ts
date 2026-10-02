import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands } from '../../src/index.js';
import type { GameCommand, GameState, Good } from '../../src/index.js';
import { advanceAutomatic } from '../../src/round/advanceAutomatic.js';
import { fixture } from '../helpers/state.js';

function captain(n=3, chooser=0) {
  const s=fixture(n);const actorId=s.seatOrder[chooser]!;s.governorPlayerId=actorId;
  s.roleCards.find(card=>card.kind==='captain')!.selectedBy=actorId;
  s.phase={kind:'captain-loading',actorId,roleChooserId:actorId,actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:0};
  return s;
}
function goods(s:ReturnType<typeof captain>,seat:number,good:Good,count:number) {
  s.players.find(p=>p.playerId===s.seatOrder[seat])!.goods[good]+=count;s.supply.goods[good]-=count;
}
function cargo(s:ReturnType<typeof captain>,index:number,good:Good,count:number) {
  s.ships[index]={...s.ships[index]!,goodType:good,loadedCount:count};s.supply.goods[good]-=count;
}
function wharf(s:ReturnType<typeof captain>,seat=0,occupiedSlots=1) {
  const p=s.players.find(p=>p.playerId===s.seatOrder[seat])!;
  p.buildings.push({instanceId:createId('building',`wharf-${seat}`),buildingTypeId:'wharf',occupiedSlots});
  p.personalShip={goodType:null,loadedCount:0,usedThisPhase:false};
  s.supply.buildingStock.wharf--;s.supply.workerCount-=occupiedSlots;
}
function freeze(value:unknown):void {
  if(value && typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}
}
function submit(s:GameState,shipment:unknown,extra:Record<string,unknown>={}) {
  if(s.phase.kind!=='captain-loading')throw Error('fixture');
  return applyCommand(s,{kind:'load',actorId:s.phase.actorId,shipment,useHarbor:false,...extra} as GameCommand);
}

it('CAP-01: advertises mandatory quantities using the existing cargo eligibility rules',()=>{
  const s=captain(4);goods(s,0,'sugar',6);goods(s,0,'corn',1);assertGameState(s);
  expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'captain-loading',actorId:s.seatOrder[0],loads:[
    ...s.ships.map(ship=>({shipment:{kind:'cargo',good:'corn',shipId:ship.instanceId},quantity:1})),
    ...s.ships.slice(1).map(ship=>({shipment:{kind:'cargo',good:'sugar',shipId:ship.instanceId},quantity:6})),
  ],harborChoices:[false],canDeclineWharf:false}]);
  expect(getLegalCommands(s,s.seatOrder[1]!)).toEqual([]);
});

it('CAP-01: loads all six Sugar onto an eligible ship and advances without mutation and awards shipping points',()=>{
  const s=captain(4);goods(s,0,'sugar',6);goods(s,0,'corn',1);goods(s,1,'fruit',1);
  if(s.phase.kind==='captain-loading')s.phase.consecutiveNoLoads=2;
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  const shipment={kind:'cargo',shipId:s.ships[1]!.instanceId,good:'sugar'};
  const result=submit(s,shipment);if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,revision:2,
    players:s.players.map((p,i)=>i===0?{...p,earnedVp:7,goods:{...p.goods,sugar:0}}:p),
    supply:{...s.supply,vpRemaining:93},
    ships:s.ships.map((ship,i)=>i===1?{...ship,goodType:'sugar',loadedCount:6}:ship),
    phase:{kind:'captain-loading',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1,captainBonusUsed:true,consecutiveNoLoads:0},
  });
  expect(result.events).toEqual([
    {kind:'goods-moved',revision:2,index:0,good:'sugar',quantity:6,from:{kind:'player',playerId:s.seatOrder[0]},to:{kind:'cargo-ship',shipId:s.ships[1]!.instanceId}},
    {kind:'vp-earned',revision:2,index:1,playerId:s.seatOrder[0],quantity:7,overflow:0},
    {kind:'phase-changed',revision:2,index:2,from:'captain-loading',to:'captain-loading'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);expect(submit(s,shipment)).toEqual(result);
});

it('CAP-01: a smaller good remains a valid choice, but an undersized ship does not',()=>{
  const s=captain(4);goods(s,0,'sugar',6);goods(s,0,'corn',1);goods(s,1,'fruit',1);
  const before=JSON.stringify(s);
  expect(submit(s,{kind:'cargo',shipId:s.ships[0]!.instanceId,good:'sugar'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  const result=submit(s,{kind:'cargo',shipId:s.ships[0]!.instanceId,good:'corn'});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.goods).toEqual({...s.players[0]!.goods,corn:0});
  expect(result.state.ships[0]).toMatchObject({goodType:'corn',loadedCount:1});
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('CAP-02: fills only the matching ship and retains the excess without unloading',()=>{
  const s=captain(4);cargo(s,0,'sugar',4);goods(s,0,'sugar',3);assertGameState(s);
  expect(submit(s,{kind:'cargo',shipId:s.ships[1]!.instanceId,good:'sugar'})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  const result=submit(s,{kind:'cargo',shipId:s.ships[0]!.instanceId,good:'sugar'});if(!result.ok)throw Error(result.error.message);
  expect(result.state.players[0]!.goods.sugar).toBe(2);
  expect(result.state.ships[0]).toMatchObject({goodType:'sugar',loadedCount:5});
  expect(result.state.supply).toEqual({...s.supply,vpRemaining:s.supply.vpRemaining-2});
  expect(result.state.phase).toEqual({kind:'captain-retention',actorId:s.seatOrder[0],roleChooserId:s.seatOrder[0],actorIndex:0});
  expect(result.events[0]).toMatchObject({kind:'goods-moved',quantity:1});assertGameState(result.state);
});

it('CAP-05: skips revisit A for the second good and only a complete no-load cycle enters retention',()=>{
  const s=captain();goods(s,0,'corn',1);goods(s,0,'fruit',1);const before=JSON.stringify(s);freeze(s);
  const first=submit(s,{kind:'cargo',shipId:s.ships[0]!.instanceId,good:'corn'});if(!first.ok)throw Error(first.error.message);
  expect(first.state.phase).toEqual({kind:'captain-loading',actorId:s.seatOrder[0],roleChooserId:s.seatOrder[0],actorIndex:0,captainBonusUsed:true,consecutiveNoLoads:2});
  expect(first.events.map(e=>[e.kind,e.revision,e.index])).toEqual([
    ['goods-moved',2,0],['vp-earned',2,1],['phase-changed',2,2],['phase-changed',2,3],['phase-changed',2,4],
  ]);
  const second=submit(first.state,{kind:'cargo',shipId:s.ships[1]!.instanceId,good:'fruit'});if(!second.ok)throw Error(second.error.message);
  expect(second.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(second.state.ships.map(ship=>[ship.goodType,ship.loadedCount])).toEqual([['corn',1],['fruit',1],[null,0]]);
  expect(second.events).toEqual([
    {kind:'goods-moved',revision:3,index:0,good:'fruit',quantity:1,from:{kind:'player',playerId:s.seatOrder[0]},to:{kind:'cargo-ship',shipId:s.ships[1]!.instanceId}},
    {kind:'vp-earned',revision:3,index:1,playerId:s.seatOrder[0],quantity:1,overflow:0},
    {kind:'phase-changed',revision:3,index:2,from:'captain-loading',to:'captain-loading'},
    {kind:'phase-changed',revision:3,index:3,from:'captain-loading',to:'captain-loading'},
    {kind:'phase-changed',revision:3,index:4,from:'captain-loading',to:'captain-loading'},
    {kind:'phase-changed',revision:3,index:5,from:'captain-loading',to:'captain-retention'},
    {kind:'phase-changed',revision:3,index:6,from:'captain-retention',to:'captain-retention'},
    {kind:'phase-changed',revision:3,index:7,from:'captain-retention',to:'captain-retention'},
    {kind:'phase-changed',revision:3,index:8,from:'captain-retention',to:'phase-completion'},
    {kind:'phase-changed',revision:3,index:9,from:'phase-completion',to:'role-selection'},
  ]);
  expect(second.state.supply).toEqual({...s.supply,vpRemaining:72});expect(second.state.players.map(p=>p.earnedVp)).toEqual([3,0,0]);
  expect(second.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);assertGameState(second.state);
  expect(applyCommand(second.state,{kind:'load',actorId:s.seatOrder[1]!,shipment:{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},useHarbor:false})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});

it.each([3,4,5])('CAPTAIN-005: uses seat order around a nonfirst chooser for %i players',n=>{
  const s=captain(n,n-1);goods(s,n-1,'corn',1);goods(s,0,'fruit',1);s.players.reverse();assertGameState(s);
  const first=submit(s,{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId});if(!first.ok)throw Error(first.error.message);
  expect(first.state.phase).toEqual({kind:'captain-loading',actorId:s.seatOrder[0],roleChooserId:s.seatOrder[n-1],actorIndex:1,captainBonusUsed:true,consecutiveNoLoads:0});
  const second=submit(first.state,{kind:'cargo',good:'fruit',shipId:s.ships[1]!.instanceId});if(!second.ok)throw Error(second.error.message);
  expect(second.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[0]});
  assertGameState(second.state);
});

it.each([3,4,5])('CAPTAIN-005: selecting Captain with no goods advances exactly %i no-load visits',n=>{
  const s=fixture(n);const before=JSON.stringify(s);freeze(s);
  const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards.find(card=>card.kind==='captain')!.instanceId});
  if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase).toEqual({kind:'role-selection',actorId:s.seatOrder[1]});
  expect(result.state.revision).toBe(2);expect(result.events).toHaveLength(2*n+3);
  expect(result.events.map(e=>[e.revision,e.index])).toEqual(Array.from({length:2*n+3},(_,i)=>[2,i]));
  expect(result.events.at(-1)).toMatchObject({kind:'phase-changed',from:'phase-completion',to:'role-selection'});
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('CAP-04: an eligible optional Wharf stops auto-skipping, and decline ends a full no-load traversal',()=>{
  const s=captain();cargo(s,0,'corn',4);cargo(s,1,'fruit',5);cargo(s,2,'coffee',6);goods(s,0,'sugar',3);wharf(s);
  assertGameState(s);const before=JSON.stringify(s);freeze(s);
  expect(advanceAutomatic({ok:true,state:s,events:[]})).toEqual({ok:true,state:s,events:[]});
  expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'captain-loading',actorId:s.seatOrder[0],loads:[{shipment:{kind:'personal',good:'sugar'},quantity:3}],harborChoices:[false],canDeclineWharf:true}]);
  const result=applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!});if(!result.ok)throw Error(result.error.message);
  expect(result.state).toEqual({...s,revision:2,phase:{kind:'captain-retention',actorId:s.seatOrder[0],roleChooserId:s.seatOrder[0],actorIndex:0}});
  expect(result.events).toEqual([
    {kind:'phase-changed',revision:2,index:0,from:'captain-loading',to:'captain-loading'},
    {kind:'phase-changed',revision:2,index:1,from:'captain-loading',to:'captain-loading'},
    {kind:'phase-changed',revision:2,index:2,from:'captain-loading',to:'captain-retention'},
  ]);
  expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
});

it('CAPTAIN-004: declining Wharf never permits passing a mandatory cargo load',()=>{
  const s=captain();goods(s,0,'sugar',3);wharf(s);assertGameState(s);const before=JSON.stringify(s);freeze(s);
  expect(getLegalCommands(s,s.seatOrder[0]!)[0]).toMatchObject({canDeclineWharf:false});
  expect(applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(JSON.stringify(s)).toBe(before);
});

it('CAPTAIN-005: each eligible Wharf decision is resolved once in an otherwise empty traversal',()=>{
  const s=captain();cargo(s,0,'corn',4);cargo(s,1,'fruit',5);cargo(s,2,'coffee',6);
  goods(s,0,'sugar',3);goods(s,1,'tobacco',2);wharf(s,0);wharf(s,1);assertGameState(s);
  const first=applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!});if(!first.ok)throw Error(first.error.message);
  expect(first.state.phase).toMatchObject({kind:'captain-loading',actorId:s.seatOrder[1],consecutiveNoLoads:1});
  const second=applyCommand(first.state,{kind:'decline-wharf',actorId:s.seatOrder[1]!});if(!second.ok)throw Error(second.error.message);
  expect(second.state.phase).toMatchObject({kind:'captain-retention',actorId:s.seatOrder[0]});
  expect(second.state.players).toEqual(s.players);assertGameState(second.state);
});

it('CAPTAIN-005: a later load resets the traversal and permits a new optional Wharf decision',()=>{
  const s=captain();cargo(s,0,'sugar',4);cargo(s,1,'corn',1);cargo(s,2,'coffee',6);
  goods(s,0,'sugar',3);goods(s,1,'corn',1);wharf(s);assertGameState(s);
  const declined=applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!});if(!declined.ok)throw Error(declined.error.message);
  const loaded=submit(declined.state,{kind:'cargo',shipId:s.ships[1]!.instanceId,good:'corn'});if(!loaded.ok)throw Error(loaded.error.message);
  expect(loaded.state.phase).toEqual({kind:'captain-loading',actorId:s.seatOrder[0],roleChooserId:s.seatOrder[0],actorIndex:0,captainBonusUsed:false,consecutiveNoLoads:1});
  const final=applyCommand(loaded.state,{kind:'decline-wharf',actorId:s.seatOrder[0]!});if(!final.ok)throw Error(final.error.message);
  expect(final.state.phase).toMatchObject({kind:'captain-retention'});assertGameState(final.state);
});

it.each(['inactive','used','empty'] as const)('CAPTAIN-004: %s Wharf cannot create a decision or a pass',condition=>{
  const s=captain();cargo(s,0,'corn',4);cargo(s,1,'fruit',5);cargo(s,2,'coffee',6);
  if(condition!=='empty')goods(s,0,'sugar',3);
  wharf(s,0,condition==='inactive'?0:1);
  if(condition==='used'){s.players[0]!.personalShip={goodType:'tobacco',loadedCount:1,usedThisPhase:true};s.supply.goods.tobacco--;}
  assertGameState(s);expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);
  expect(applyCommand(s,{kind:'decline-wharf',actorId:s.seatOrder[0]!})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  const result=advanceAutomatic({ok:true,state:s,events:[]});if(!result.ok)throw Error(result.error.message);
  expect(result.state.phase.kind).toBe(condition==='empty'?'role-selection':'captain-retention');expect(result.state.players).toEqual(s.players);assertGameState(result.state);
});

it('CAPTAIN-004: Personal Ship execution transfers all cargo and scores',()=>{
  const s=captain();goods(s,0,'sugar',3);wharf(s);const before=JSON.stringify(s);freeze(s);
  expect(submit(s,{kind:'personal',good:'sugar'})).toMatchObject({ok:true,state:{players:expect.arrayContaining([expect.objectContaining({playerId:s.seatOrder[0],earnedVp:4})])}});
  expect(JSON.stringify(s)).toBe(before);
});

it.each([null,undefined,[],{},'corn',{kind:'cargo'},{kind:'cargo',good:'unknown',shipId:'ship-0'},
  {kind:'cargo',good:'corn',shipId:'missing'},{kind:'cargo',good:'corn',shipId:'ship-0',quantity:1},
  {kind:'cargo',good:'corn',shipId:'ship-0',quantity:2},
])('CAPTAIN-002: malformed, unknown or quantity-bearing shipment %# rejects unchanged',shipment=>{
  const s=captain();goods(s,0,'corn',2);const before=JSON.stringify(s);freeze(s);
  const result=submit(s,shipment);expect(result).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(result).not.toHaveProperty('state');expect(result).not.toHaveProperty('events');expect(JSON.stringify(s)).toBe(before);
});

it.each([{quantity:1},{quantity:2},{useHarbor:true},{useHarbor:undefined},{kind:'pass'},{kind:'decline-wharf'}])('CAPTAIN-001: cannot pass, choose a quantity, or invoke unfinished Harbor %#',extra=>{
  const s=captain();goods(s,0,'corn',2);const before=JSON.stringify(s);freeze(s);
  const result=submit(s,{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},extra);
  expect(result.ok).toBe(false);expect(result).not.toHaveProperty('state');expect(result).not.toHaveProperty('events');expect(JSON.stringify(s)).toBe(before);
});

it('rejects wrong actors and numeric revision exhaustion without turning a mandatory load into a skip',()=>{
  const s=captain();goods(s,0,'corn',2);
  expect(submit(s,{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId},{actorId:s.seatOrder[1]})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
  s.revision=Number.MAX_SAFE_INTEGER;const before=JSON.stringify(s);freeze(s);
  expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);
  expect(submit(s,{kind:'cargo',good:'corn',shipId:s.ships[0]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
  expect(advanceAutomatic({ok:true,state:s,events:[]})).toEqual({ok:true,state:s,events:[]});expect(JSON.stringify(s)).toBe(before);
});

it.each([0, 1, 2])('Captain chooser seat %i earns 3 for two corn, then next corn owner gets a turn', chooser => {
  const s = fixture(3), a = s.seatOrder[chooser]!, b = s.seatOrder[(chooser + 1) % 3]!;
  s.governorPlayerId = a;
  s.phase = { kind: 'role-selection', actorId: a };
  s.players.find(p => p.playerId === a)!.goods.corn = 2;
  s.players.find(p => p.playerId === b)!.goods.corn = 2;
  s.supply.goods.corn -= 4;
  assertGameState(s);
  const chosen = applyCommand(s, { kind: 'choose-role', actorId: a, roleCardId: s.roleCards.find(c => c.kind === 'captain')!.instanceId });
  if (!chosen.ok) throw Error(chosen.error.message);
  const shipment = { kind: 'cargo' as const, good: 'corn' as const, shipId: s.ships[0]!.instanceId };
  const first = applyCommand(chosen.state, { kind: 'load', actorId: a, shipment, useHarbor: false });
  if (!first.ok) throw Error(first.error.message);
  expect(first.state.players.find(p => p.playerId === a)!.earnedVp).toBe(3);
  expect(first.state.phase).toMatchObject({ kind: 'captain-loading', actorId: b });
  expect(getLegalCommands(first.state, b)).toEqual(expect.arrayContaining([expect.objectContaining({ phase: 'captain-loading', loads: expect.arrayContaining([{ shipment, quantity: 2 }]) })]));
  const second = applyCommand(first.state, { kind: 'load', actorId: b, shipment, useHarbor: false });
  if (!second.ok) throw Error(second.error.message);
  expect(second.state.players.find(p => p.playerId === b)!.earnedVp).toBe(2);
});
