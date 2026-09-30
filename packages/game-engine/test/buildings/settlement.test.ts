import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,getLegalCommands } from '../../src/index.js';
import type { BuildingType,GameState } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(size=10,active=true){const s=fixture(5);s.roleCards[0]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'planter-before',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};while(s.players[0]!.countryside.length<size)s.players[0]!.countryside.push({...s.estateBag.shift()!,occupied:false});for(const type of ['hacienda','hospital','builders-yard'] as BuildingType[]){s.players[0]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:Number(active)});s.supply.buildingStock[type]--;s.supply.workerCount-=Number(active);}return s;}
function hacienda(s:GameState,accept=true){const r=applyCommand(s,{kind:'use-hacienda',actorId:s.seatOrder[0]!,accept});if(!r.ok)throw Error(r.error.message);return r;}
it('B-08/11 commits hidden draw, then ordinary Quarry, then exactly one worker',()=>{
 const s=setup(),hidden=s.estateBag[0]!,before=JSON.stringify(s);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'planter-before',actorId:s.seatOrder[0],accept:[false,true]}]);
 const h=hacienda(s);expect(h.state.players[0]!.countryside.at(-1)).toEqual({...hidden,occupied:false});expect(h.state.phase).toMatchObject({kind:'planter-choice',acquiredTileIds:[hidden.instanceId]});expect(h.state.estateBag).toEqual(s.estateBag.slice(1));expect(h.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);
 const p=applyCommand(h.state,{kind:'plant',actorId:s.seatOrder[0]!,choice:{kind:'quarry'}});if(!p.ok)throw Error(p.error.message);const quarry=p.state.players[0]!.countryside.at(-1)!;
 expect(p.state.players[0]!.countryside).toHaveLength(12);expect(getLegalCommands(p.state,s.seatOrder[0]!)).toEqual([{phase:'planter-worker',actorId:s.seatOrder[0],tileIds:[null,hidden.instanceId,quarry.instanceId]}]);
 for(const tileId of [hidden.instanceId,quarry.instanceId]){const r=applyCommand(p.state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.countryside.filter(t=>t.occupied).map(t=>t.instanceId)).toEqual([tileId]);expect(r.state.supply.workerCount).toBe(s.supply.workerCount-1);expect(r.state.supply.workRegisterCount).toBe(5);expect(r.state.phase).toMatchObject({kind:'planter-choice',actorId:s.seatOrder[1]});expect(applyCommand(r.state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId}).ok).toBe(false);assertGameState(r.state);}
 expect(applyCommand(p.state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId:s.players[0]!.countryside[0]!.instanceId})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it('11→12 skips normal choice, decline stays optional',()=>{
 const s=setup(11);const r=hacienda(s);expect(r.state.phase.kind).toBe('planter-worker');expect(r.state.players[0]!.countryside).toHaveLength(12);
 const d=hacienda(s,false);expect(d.state.phase.kind).toBe('planter-choice');expect(d.state.players).toEqual(s.players);
 const hospital=applyCommand(r.state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId:null});if(!hospital.ok)throw Error(hospital.error.message);expect(hospital.state.supply.workerCount).toBe(s.supply.workerCount);
});
it.each([1,0])('Hospital uses supply %i before Register',count=>{
 const s=setup(11);s.players[1]!.idleWorkerCount=s.supply.workerCount-count;s.supply.workerCount=count;
 const h=hacienda(s),tileId=h.state.players[0]!.countryside.at(-1)!.instanceId;
 const r=applyCommand(h.state,{kind:'use-hospital',actorId:s.seatOrder[0]!,tileId});if(!r.ok)throw Error(r.error.message);
 expect(r.state.supply.workerCount).toBe(0);expect(r.state.supply.workRegisterCount).toBe(count?5:4);expect(r.events[0]).toMatchObject({kind:'workers-received',quantity:1,source:count?'supply':'register'});assertGameState(r.state);
});
it('inactive abilities reject, and exhausted workers automatically skip Hospital',()=>{
 const s=setup(11,false);expect(hacienda(s,false).state.phase.kind).toBe('planter-choice');expect(applyCommand(s,{kind:'use-hacienda',actorId:s.seatOrder[0]!,accept:true})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const a=setup(11);a.players[1]!.idleWorkerCount=a.supply.workerCount+a.supply.workRegisterCount;a.supply.workerCount=0;a.supply.workRegisterCount=0;expect(hacienda(a).state.phase).toMatchObject({kind:'planter-choice',actorId:a.seatOrder[1]});
});
it('Builder’s Yard allows nonchooser Quarry only when occupied',()=>{
 for(const active of [false,true]){const s=setup(1,active);s.governorPlayerId=s.seatOrder[4]!;s.roleCards[0]!.selectedBy=s.seatOrder[4]!;s.phase={kind:'planter-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[4]!,actorIndex:1,acquiredTileIds:[]};const r=applyCommand(s,{kind:'plant',actorId:s.seatOrder[0]!,choice:{kind:'quarry'}});expect(r.ok).toBe(active);}
});
it('Hacienda recycles discards deterministically without drawing from the market',()=>{
 const s=setup();s.estateDiscard=s.estateBag;s.estateBag=[];const before=JSON.stringify(s);
 const r=hacienda(s);expect(hacienda(s)).toEqual(r);expect(r.state.estateDiscard).toEqual([]);expect(r.state.estateBag).toHaveLength(s.estateDiscard.length-1);expect(r.state.estateMarket).toEqual(s.estateMarket);expect(r.state.rng).not.toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
});
it('empty hidden supply blocks Hacienda but leaves ordinary market choices',()=>{
 const s=setup();for(const tile of s.estateBag){const p=s.players.slice(1).find(p=>p.countryside.length<12)!;p.countryside.push({...tile,occupied:false});}s.estateBag=[];assertGameState(s);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{accept:[false]}]);expect(applyCommand(s,{kind:'use-hacienda',actorId:s.seatOrder[0]!,accept:true})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(hacienda(s,false).state.estateMarket).toEqual(s.estateMarket);
});
it('rejects malformed choices, full Countryside, wrong actor and exhausted revisions',()=>{
 const s=setup(12);expect(applyCommand(s,{kind:'use-hacienda',actorId:s.seatOrder[0]!,accept:true})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const a=setup();expect(applyCommand(a,{kind:'use-hacienda',actorId:s.seatOrder[1]!,accept:true})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 a.revision=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(a,a.seatOrder[0]!)).toMatchObject([{accept:[]}]);expect(applyCommand(a,{kind:'use-hacienda',actorId:a.seatOrder[0]!,accept:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const h=hacienda(setup(11)).state;
 for(const tileId of [undefined,42,{},[]])expect(applyCommand(h,{kind:'use-hospital',actorId:h.seatOrder[0]!,tileId} as unknown as import('../../src/index.js').GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
