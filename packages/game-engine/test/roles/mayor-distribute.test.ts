import { expect, it } from 'vitest';
import { applyCommand, assertGameState, getLegalCommands } from '../../src/index.js';
import type { GameCommand } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(n=3,register=8) {
 const s=fixture(n);s.supply.workerCount+=n-register;s.supply.workRegisterCount=register;
 s.governorPlayerId=s.seatOrder[n-1]!;
 s.roleCards[1]!.selectedBy=s.governorPlayerId;
 s.phase={kind:'recruiter-advantage',actorId:s.governorPlayerId,roleChooserId:s.governorPlayerId,actorIndex:0};
 return s;
}
it.each([{n:3,r:8,g:[3,3,2]},{n:4,r:6,g:[2,2,1,1]},{n:5,r:7,g:[2,2,1,1,1]}])('REC-01 $n players accept/decline, clockwise from chooser',({n,r,g})=>{
 for(const accept of [false,true]) {
  const s=setup(n,r);s.players.reverse();const before=JSON.stringify(s);
  expect(getLegalCommands(s,s.governorPlayerId)).toEqual([{phase:'recruiter-advantage',actorId:s.governorPlayerId,accept:[false,true]}]);
  const result=applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept});
  if(!result.ok)throw Error(result.error.message);
  const order=[s.seatOrder[n-1]!,...s.seatOrder.slice(0,n-1)];
  expect(order.map(id=>result.state.players.find(p=>p.playerId===id)!.idleWorkerCount)).toEqual(g.map((v,i)=>v+(i===0 && accept?1:0)));
  expect(result.state.supply.workRegisterCount).toBe(0);expect(result.state.supply.workerCount).toBe(s.supply.workerCount-Number(accept));
  expect(result.state.phase).toEqual({kind:'recruiter-placement',roleChooserId:s.governorPlayerId,actorId:s.governorPlayerId,actorIndex:0,confirmedPlayerIds:[]});
  const events=[...(accept?[{kind:'workers-received',playerId:s.governorPlayerId,quantity:1,source:'supply'}]:[]),
   {kind:'phase-changed',from:'recruiter-advantage',to:'recruiter-distribution'},
   ...order.map((playerId,i)=>({kind:'workers-received',playerId,quantity:g[i],source:'register'})),
   {kind:'phase-changed',from:'recruiter-distribution',to:'recruiter-placement'}];
  expect(result.events).toEqual(events.map((e,index)=>({...e,index,revision:s.revision+1})));
  expect(result.state.rng).toEqual(s.rng);expect(JSON.stringify(s)).toBe(before);assertGameState(result.state);
 }
});
it.each([undefined,null,0,1,'true',{},[]])('rejects malformed advantage %j',accept=>{
 const s=setup();const before=JSON.stringify(s);
 expect(applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept} as GameCommand)).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 expect(JSON.stringify(s)).toBe(before);
});
it('handles empty supply, existing workers and a Register smaller than the player count',()=>{
 const s=setup(3,1);s.players[0]!.idleWorkerCount=s.supply.workerCount;s.supply.workerCount=0;
 expect(getLegalCommands(s,s.governorPlayerId)).toEqual([{phase:'recruiter-advantage',actorId:s.governorPlayerId,accept:[false]}]);
 expect(applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:true})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const result=applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:false});if(!result.ok)throw Error(result.error.message);
 expect(result.state.players.map(p=>p.idleWorkerCount)).toEqual([s.players[0]!.idleWorkerCount,0,1]);
 expect(result.events.filter(e=>e.kind==='workers-received')).toHaveLength(1);
 expect(result.state.endTriggers).toEqual([]);
});
it('skips unavailable advantage on role selection, distributes an empty Register, and stops at placement',()=>{
 const s=fixture();s.players[0]!.idleWorkerCount=s.supply.workerCount+s.supply.workRegisterCount;s.supply.workerCount=0;s.supply.workRegisterCount=0;
 const result=applyCommand(s,{kind:'choose-role',actorId:s.seatOrder[0]!,roleCardId:s.roleCards[1]!.instanceId});if(!result.ok)throw Error(result.error.message);
 expect(result.state.phase.kind).toBe('recruiter-placement');expect(result.state.revision).toBe(s.revision+1);
 expect(result.events.map(e=>e.kind)).toEqual(['role-selected','phase-changed','phase-changed','phase-changed']);
 expect(result.state.players).toEqual(s.players);
});
it('rejects other actors and repeat use',()=>{
 const s=setup();expect(applyCommand(s,{kind:'recruit-worker',actorId:s.seatOrder[0]!,accept:true})).toMatchObject({ok:false,error:{code:'WRONG_ACTOR'}});
 const result=applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:true});if(!result.ok)throw Error(result.error.message);
 expect(applyCommand(result.state,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:true})).toMatchObject({ok:false,error:{code:'WRONG_PHASE'}});
});
it('preserves occupied workers and rejects an exhausted revision counter',()=>{
 const s=setup();s.players[0]!.countryside[0]!.occupied=true;s.supply.workerCount--;
 const result=applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:false});if(!result.ok)throw Error(result.error.message);
 expect(result.state.players[0]!.countryside).toEqual(s.players[0]!.countryside);
 s.revision=Number.MAX_SAFE_INTEGER;
 expect(getLegalCommands(s,s.governorPlayerId)).toEqual([{phase:'recruiter-advantage',actorId:s.governorPlayerId,accept:[]}]);
 expect(applyCommand(s,{kind:'recruit-worker',actorId:s.governorPlayerId,accept:false})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
});
