import { PRODUCTION_BUILDINGS } from './definitions.js';
import { isBuildingActive } from './activation.js';
import type { PlayerState } from '../model/state.js';

export function fireStationBonus(player:PlayerState):number {
 if(!isBuildingActive(player,'fire-station'))return 0;
 return player.buildings.reduce((total,b)=>total+(PRODUCTION_BUILDINGS.includes(b.buildingTypeId)
  ? (b.buildingTypeId==='small-fruit-depot' || b.buildingTypeId==='small-sugar-mill'?1:2):0),0);
}
export function residenceBonus(player:PlayerState):number {
 if(!isBuildingActive(player,'residence'))return 0;
 return player.countryside.length<=9?4:player.countryside.length-5;
}
export function fortressBonus(player:PlayerState):number {
 if(!isBuildingActive(player,'fortress'))return 0;
 const workers=player.idleWorkerCount+player.countryside.filter(t=>t.occupied).length
  +player.buildings.reduce((total,b)=>total+b.occupiedSlots,0);
 return Math.floor(workers/3);
}
