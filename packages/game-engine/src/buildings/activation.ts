import type { BuildingType, PlayerState } from '../model/state.js';
export function isBuildingActive(player:PlayerState,type:BuildingType):boolean {
 return player.buildings.some(building=>building.buildingTypeId===type && building.occupiedSlots>0);
}
