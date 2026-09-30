import { expect,it } from 'vitest';
import { cargoShipOptions,findCargoShipOption } from '../../src/roles/captain/shipOptions.js';
import { fixture } from '../helpers/state.js';
it('CAP-01 maximizes a chosen good, not all goods',()=>{
 const s=fixture(4),goods={...s.players[0]!.goods,sugar:6,corn:1};const before=JSON.stringify({goods,ships:s.ships});
 const options=cargoShipOptions(goods,s.ships);
 expect(options.filter(o=>o.shipment.good==='sugar')).toEqual(s.ships.slice(1).map(ship=>({shipment:{kind:'cargo',good:'sugar',shipId:ship.instanceId},quantity:6})));
 expect(options.filter(o=>o.shipment.good==='corn')).toEqual(s.ships.map(ship=>({shipment:{kind:'cargo',good:'corn',shipId:ship.instanceId},quantity:1})));
 expect(findCargoShipOption(goods,s.ships,'sugar',s.ships[0]!.instanceId)).toBeUndefined();
 expect(JSON.stringify({goods,ships:s.ships})).toBe(before);
});
it('CAP-02 allows all ties and forces the matching ship even with one free hold',()=>{
 const s=fixture(4),goods={...s.players[0]!.goods,sugar:3};
 expect(cargoShipOptions(goods,s.ships).map(o=>[o.shipment.shipId,o.quantity])).toEqual(s.ships.map(ship=>[ship.instanceId,3]));
 s.ships[0]={...s.ships[0]!,goodType:'sugar',loadedCount:4};
 expect(cargoShipOptions(goods,s.ships)).toEqual([{shipment:{kind:'cargo',shipId:s.ships[0].instanceId,good:'sugar'},quantity:1}]);
 expect(findCargoShipOption(goods,s.ships,'sugar',s.ships[1]!.instanceId)).toBeUndefined();
 s.ships[0]={...s.ships[0],loadedCount:5};expect(cargoShipOptions(goods,s.ships)).toEqual([]);
});
it('rejects mixed goods, absent goods and unknown selections',()=>{
 const s=fixture(4),goods={...s.players[0]!.goods,coffee:2};s.ships[0]={...s.ships[0]!,goodType:'sugar',loadedCount:1};
 expect(findCargoShipOption(goods,s.ships,'coffee',s.ships[0].instanceId)).toBeUndefined();
 expect(findCargoShipOption(goods,s.ships,'sugar',s.ships[0].instanceId)).toBeUndefined();
 for(const good of [null,undefined,42,'unknown',{}])expect(findCargoShipOption(goods,s.ships,good,s.ships[1]!.instanceId)).toBeUndefined();
 expect(findCargoShipOption(goods,s.ships,'coffee','missing')).toBeUndefined();
 expect(cargoShipOptions(s.players[0]!.goods,s.ships)).toEqual([]);
});
it.each([3,4,5])('chooses only largest empty ship when goods exceed all capacities for %i players',n=>{
 const s=fixture(n),goods={...s.players[0]!.goods,fruit:10};
 const expected={shipment:{kind:'cargo',shipId:s.ships[2]!.instanceId,good:'fruit'},quantity:n+3};
 expect(cargoShipOptions(goods,s.ships)).toEqual([expected]);expect(findCargoShipOption(goods,s.ships,'fruit',s.ships[2]!.instanceId)).toEqual(expected);
});
it('uses available empty ships only and returns no options when all incompatible',()=>{
 const s=fixture(4),goods={...s.players[0]!.goods,coffee:6};
 s.ships[2]={...s.ships[2]!,goodType:'corn',loadedCount:1};
 expect(cargoShipOptions(goods,s.ships)).toEqual([{shipment:{kind:'cargo',shipId:s.ships[1]!.instanceId,good:'coffee'},quantity:6}]);
 s.ships[1]={...s.ships[1]!,goodType:'sugar',loadedCount:1};s.ships[0]={...s.ships[0]!,goodType:'fruit',loadedCount:1};expect(cargoShipOptions(goods,s.ships)).toEqual([]);
});
