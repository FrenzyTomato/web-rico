import type { Shipment } from '../../model/commands.js';
import type { CargoShip, Good, Goods } from '../../model/state.js';

export interface CargoShipOption {
 readonly shipment: Extract<Shipment,{kind:'cargo'}>;
 readonly quantity:number;
}
const goodTypes:readonly Good[]=['corn','fruit','sugar','tobacco','coffee'];
/** Input comes from an invariant-validated state; personal ships are separate. */
export function cargoShipOptions(goods:Goods,ships:readonly CargoShip[]):CargoShipOption[] {
 const options:CargoShipOption[]=[];
 for(const good of goodTypes){
  if(goods[good]===0)continue;
  const matching=ships.find(ship=>ship.goodType===good);
  const candidates=matching?[matching]:ships.filter(ship=>ship.goodType===null);
  const loads=candidates.map(ship=>({shipment:{kind:'cargo' as const,shipId:ship.instanceId,good},quantity:Math.min(goods[good],ship.capacity-ship.loadedCount)}));
  const maximum=Math.max(0,...loads.map(load=>load.quantity));
  options.push(...loads.filter(load=>load.quantity>0 && load.quantity===maximum));
 }
 return options;
}
/** Reuses advertised options for execution validation; quantity is never chosen by the player. */
export function findCargoShipOption(goods:Goods,ships:readonly CargoShip[],good:unknown,shipId:unknown):CargoShipOption|undefined {
 return cargoShipOptions(goods,ships).find(option=>option.shipment.good===good && option.shipment.shipId===shipId);
}
