import type { Good,PlayerState } from '../model/state.js';
import { isBuildingActive } from './activation.js';
export function personalLoads(player:PlayerState) {
 if(!isBuildingActive(player,'wharf') || !player.personalShip || player.personalShip.usedThisPhase)return [];
 return (Object.keys(player.goods) as Good[]).filter(g=>player.goods[g]>0).map(good=>({shipment:{kind:'personal' as const,good},quantity:player.goods[good]}));
}
export function harborChoices(player:PlayerState):boolean[] {
 return isBuildingActive(player,'harbor')?[false,true]:[false];
}
