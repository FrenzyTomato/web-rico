import type { Good, PlayerState } from '../model/state.js';
import { isBuildingActive } from './activation.js';
export function permitsTradingGood(player:PlayerState,house:readonly Good[],good:Good):boolean {
 return house.length<4 && (!house.includes(good) || isBuildingActive(player,'office'));
}
