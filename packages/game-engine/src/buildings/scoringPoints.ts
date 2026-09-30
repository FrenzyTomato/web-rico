import { PRODUCTION_BUILDINGS } from './definitions.js';
import { isBuildingActive } from './activation.js';
import type { PlayerState } from '../model/state.js';

export function customsHouseBonus(player:PlayerState):number {
 return isBuildingActive(player,'customs-house')?Math.floor(player.earnedVp/4):0;
}
export function cityHallBonus(player:PlayerState):number {
 return isBuildingActive(player,'city-hall')
  ?player.buildings.filter(b=>!PRODUCTION_BUILDINGS.includes(b.buildingTypeId)).length:0;
}
