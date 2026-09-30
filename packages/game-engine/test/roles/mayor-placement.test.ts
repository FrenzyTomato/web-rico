import { expect, it } from 'vitest';
import { applyCommand, assertGameState, createId, getLegalCommands } from '../../src/index.js';
import type { GameCommand, WorkerAllocation } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(){
 const s=fixture();s.supply.workerCount+=s.supply.workRegisterCount-3;s.supply.workRegisterCount=0;
 s.players[0]!.idleWorkerCount=3;
 s.players[0]!.buildings.push({instanceId:createId('building','market'),buildingTypeId:'small-market',occupiedSlots:0});s.supply.buildingStock['small-market']--;
 s.roleCards[1]!.selectedBy=s.seatOrder[0]!;
 s.phase={kind:'recruiter-placement',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};return s;
}
function allocation(s=setup()):WorkerAllocation{return {countryside:[{tileId:s.players[0]!.countryside[0]!.instanceId,occupied:true}],buildings:[{buildingId:s.players[0]!.buildings[0]!.instanceId,occupiedSlots:1}],idleCount:1};}
it('REC-02 fills two slots, leaves one idle and advances clockwise with exact events',()=>{
 const s=setup(),a=allocation(s),before=JSON.stringify(s);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([{phase:'recruiter-placement',actorId:s.seatOrder[0],totalWorkers:3,slots:[{kind:'countryside',instanceId:a.countryside[0]!.tileId,capacity:1},{kind:'building',instanceId:a.buildings[0]!.buildingId,capacity:1}],idleOnlyWhenAllSlotsFilled:true}]);
 const r=applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:a});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.idleWorkerCount).toBe(1);expect(r.state.players[0]!.buildings[0]!.occupiedSlots).toBe(1);
 expect(r.state.phase).toEqual({kind:'recruiter-placement',actorId:s.seatOrder[1],roleChooserId:s.seatOrder[0],actorIndex:1});
 expect(r.events).toEqual([{kind:'workers-allocated',revision:2,index:0,playerId:s.seatOrder[0],allocation:a},{kind:'phase-changed',revision:2,index:1,from:'recruiter-placement',to:'recruiter-placement'}]);
 expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
});
it.each(['idle','missing','duplicate','foreign','extra','over','negative','fraction','boolean','total','null'])('rejects %s allocation unchanged',kind=>{
 const s=setup();const a=JSON.parse(JSON.stringify(allocation(s)));
 if(kind==='idle'){a.buildings[0].occupiedSlots=0;a.idleCount=2;}
 if(kind==='missing')a.buildings=[];
 if(kind==='duplicate')a.countryside.push(a.countryside[0]);
 if(kind==='foreign')a.countryside[0].tileId=s.players[1]!.countryside[0]!.instanceId;
 if(kind==='extra')a.extra=1;
 if(kind==='over'){a.buildings[0].occupiedSlots=2;a.idleCount=0;}
 if(kind==='negative')a.idleCount=-1;
 if(kind==='fraction')a.idleCount=1.5;
 if(kind==='boolean')a.countryside[0].occupied=1;
 if(kind==='total')a.idleCount=2;
 const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:kind==='null'?null:a} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(JSON.stringify(s)).toBe(before);
});
it.each([{empty:7,supply:5,refill:5,end:true},{empty:7,supply:7,refill:7,end:false},{empty:2,supply:9,refill:4,end:false}])('REC-03 $empty empty slots / $supply supply',({empty,supply,refill,end})=>{
 const s=fixture(4);s.supply.workRegisterCount=0;s.supply.workerCount=supply;
 // Last actor has no workers. All remaining workers occupy a full first player's board plus idle.
 s.players[0]!.countryside[0]!.occupied=true;s.players[0]!.idleWorkerCount=79-supply-1;
 const types=empty===7?['large-fruit-depot','large-sugar-mill','small-market'] as const:['large-coffee-roaster'] as const;
 for(const type of types){s.players[3]!.buildings.push({instanceId:createId('building',type),buildingTypeId:type,occupiedSlots:0});s.supply.buildingStock[type]--;}
 s.roleCards[1]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'recruiter-placement',roleChooserId:s.seatOrder[0]!,actorId:s.seatOrder[3]!,actorIndex:3};
 const a:WorkerAllocation={countryside:s.players[3]!.countryside.map(t=>({tileId:t.instanceId,occupied:false})),buildings:s.players[3]!.buildings.map(b=>({buildingId:b.instanceId,occupiedSlots:0})),idleCount:0};
 const r=applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[3]!,allocation:a});if(!r.ok)throw Error(r.error.message);
 expect(r.state.supply.workRegisterCount).toBe(refill);expect(r.state.supply.workerCount).toBe(supply-refill);
 expect(r.state.phase.kind).toBe(end?'game-over':'role-selection');expect(r.state.endTriggers).toEqual(end?[{reason:'worker-shortage',role:'recruiter',triggeringRevision:2,completion:'phase-completion'}]:[]);
 expect(r.state.revision).toBe(2);expect(r.events.map(e=>e.index)).toEqual(r.events.map((_,i)=>i));expect(r.events.every(e=>e.revision===2)).toBe(true);assertGameState(r.state);
});
it('rejects allocation outside Recruitment',()=>{
 const s=fixture();expect(applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:allocation()})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
it.each([3,4,5])('completes a full Recruiter phase and round for %i players',n=>{
 const s=fixture(n);s.roleSelectionIndex=n-1;
 for(let i=0;i<n-1;i++)s.roleCards.filter(r=>r.kind!=='recruiter')[i]!.selectedBy=s.seatOrder[i]!;
 s.phase={kind:'role-selection',actorId:s.seatOrder[n-1]!};
 const selected=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[n-1]!,roleCardId:s.roleCards[1]!.instanceId});if(!selected.ok)throw Error(selected.error.message);
 const distributed=applyCommand(selected.state,{kind:'recruit-worker',actorId:s.seatOrder[n-1]!,accept:true});if(!distributed.ok)throw Error(distributed.error.message);
 let state=distributed.state;
 for(let i=0;i<n;i++){
  const actorId=s.seatOrder[(n-1+i)%n]!,p=state.players.find(p=>p.playerId===actorId)!;
  const a:WorkerAllocation={countryside:p.countryside.map(t=>({tileId:t.instanceId,occupied:true})),buildings:[],idleCount:p.idleWorkerCount-1};
  const r=applyCommand(state,{kind:'allocate-workers',actorId,allocation:a});if(!r.ok)throw Error(r.error.message);state=r.state;
 }
 expect(state.roundNumber).toBe(2);expect(state.governorPlayerId).toBe(s.seatOrder[1]);expect(state.supply.workRegisterCount).toBe(n);
 expect(state.supply.workerCount).toBe(s.supply.workerCount-1-n);expect(state.revision).toBe(s.revision+n+2);expect(state.rng).toEqual(s.rng);assertGameState(state);
});
it('permits moving existing workers and rejects wrong actors or revision overflow',()=>{
 const s=setup();s.players[0]!.idleWorkerCount=0;s.players[0]!.countryside[0]!.occupied=true;s.supply.workerCount+=2;
 const a=allocation(s);const moved={...a,countryside:a.countryside.map(t=>({...t,occupied:false})),idleCount:0};
 expect(applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[1]!,allocation:moved})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 const r=applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:moved});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.countryside[0]!.occupied).toBe(false);expect(r.state.players[0]!.buildings[0]!.occupiedSlots).toBe(1);
 s.revision=Number.MAX_SAFE_INTEGER;expect(getLegalCommands(s,s.seatOrder[0]!)).toEqual([]);
 expect(applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:moved})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
it('rejects sparse allocation arrays without throwing or changing state',()=>{
 const s=setup();s.supply.workerCount+=3;s.players[0]!.idleWorkerCount=0;
 const before=JSON.stringify(s);
 for(const sparse of ['countryside','buildings']){
  const a={countryside:[{tileId:s.players[0]!.countryside[0]!.instanceId,occupied:false}],buildings:[{buildingId:s.players[0]!.buildings[0]!.instanceId,occupiedSlots:0}],idleCount:0};
  a[sparse as 'countryside'|'buildings']=new Array(1);
  expect(applyCommand(s,{kind:'allocate-workers',actorId:s.seatOrder[0]!,allocation:a})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 }
 expect(JSON.stringify(s)).toBe(before);
});
