import type { PlayerState,Good } from '../model/state.js';
import { isBuildingActive } from './activation.js';
export function warehouseCapacity(player:PlayerState):0|1|2|3 {
 return (Number(isBuildingActive(player,'small-warehouse'))+2*Number(isBuildingActive(player,'large-warehouse'))) as 0|1|2|3;
}
export function validWarehouseTypes(player:PlayerState,types:unknown):types is Good[] {
 return Array.isArray(types) && types.length<=warehouseCapacity(player) && new Set(types).size===types.length
  && Array.from(types).every(g=>typeof g==='string' && Object.hasOwn(player.goods,g) && player.goods[g as Good]>0);
}
