import { expect,it } from 'vitest';
import { applyCommand,assertGameState,createId,getLegalCommands } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function setup(active=true){const s=fixture();s.roleCards[2]!.selectedBy=s.seatOrder[0]!;s.phase={kind:'builder-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[0]!,actorIndex:0};s.players[0]!.coins=20;s.players[0]!.buildings.push({instanceId:createId('building','school'),buildingTypeId:'school',occupiedSlots:Number(active)});s.supply.buildingStock.school--;s.supply.workerCount-=Number(active);return s;}
const purchase={buildingTypeId:'large-fruit-depot' as const,useAdvantage:true,useSchool:true};
it.each([1,0])('School gives exactly one worker from supply=%i then Register',supply=>{
 const s=setup();s.players[1]!.idleWorkerCount=s.supply.workerCount-supply;s.supply.workerCount=supply;const before=JSON.stringify(s);
 expect(getLegalCommands(s,s.seatOrder[0]!)).toMatchObject([{purchases:expect.arrayContaining([{buildingTypeId:'large-fruit-depot',useAdvantage:true,price:2,schoolChoices:[false,true]}])}]);
 const r=applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.buildings.at(-1)).toMatchObject({buildingTypeId:'large-fruit-depot',occupiedSlots:1});expect(r.state.players[0]!.coins).toBe(18);expect(r.state.supply.workerCount).toBe(0);expect(r.state.supply.workRegisterCount).toBe(supply?3:2);
 expect(r.events.filter(e=>e.kind==='workers-received')).toEqual([{kind:'workers-received',revision:2,index:2,playerId:s.seatOrder[0],quantity:1,source:supply?'supply':'register'}]);expect(JSON.stringify(s)).toBe(before);assertGameState(r.state);
});
it.each(['inactive','empty','declined'] as const)('School %s leaves purchased building unoccupied',mode=>{
 const s=setup(mode!=='inactive');if(mode==='empty'){s.players[1]!.idleWorkerCount=s.supply.workerCount+s.supply.workRegisterCount;s.supply.workerCount=0;s.supply.workRegisterCount=0;}
 if(mode!=='declined')expect(applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const r=applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase:{...purchase,useSchool:false}});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.buildings.at(-1)!.occupiedSlots).toBe(0);expect(r.state.supply.workerCount).toBe(s.supply.workerCount);expect(r.state.supply.workRegisterCount).toBe(s.supply.workRegisterCount);
});
it('newly purchased School cannot activate itself',()=>{
 const s=setup();s.players[0]!.buildings=[];s.supply.buildingStock.school++;s.supply.workerCount++;
 expect(applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase:{...purchase,buildingTypeId:'school'}})).toMatchObject({ok:false,error:{code:'ILLEGAL_CHOICE'}});
 const r=applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase:{...purchase,buildingTypeId:'school',useSchool:false}});if(!r.ok)throw Error(r.error.message);expect(r.state.players[0]!.buildings[0]!.occupiedSlots).toBe(0);
});
it('nonchooser may use School without taking the Builder privilege, and cannot reuse a purchase',()=>{
 const s=setup();s.governorPlayerId=s.seatOrder[2]!;s.roleCards[2]!.selectedBy=s.seatOrder[2]!;s.phase={kind:'builder-choice',actorId:s.seatOrder[0]!,roleChooserId:s.seatOrder[2]!,actorIndex:1};
 const r=applyCommand(s,{kind:'build',actorId:s.seatOrder[0]!,purchase:{...purchase,useAdvantage:false}});if(!r.ok)throw Error(r.error.message);
 expect(r.state.players[0]!.coins).toBe(17);expect(r.state.players[0]!.buildings.at(-1)!.occupiedSlots).toBe(1);expect(r.state.supply.workerCount).toBe(s.supply.workerCount-1);
 expect(r.events.map(e=>e.index)).toEqual(r.events.map((_,i)=>i));expect(r.events.every(e=>e.revision===2)).toBe(true);
 expect(applyCommand(r.state,{kind:'build',actorId:s.seatOrder[0]!,purchase:{...purchase,useAdvantage:false}}).ok).toBe(false);
});
