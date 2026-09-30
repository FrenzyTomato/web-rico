import type { GameState,PlayerState } from '../model/state.js';
import { isBuildingActive } from './activation.js';
/** Evaluate against the buyer before adding the new building. */
export function schoolWorkerSource(player:PlayerState,supply:GameState['supply']):'supply'|'register'|null {
 if(!isBuildingActive(player,'school'))return null;
 return supply.workerCount>0?'supply':supply.workRegisterCount>0?'register':null;
}
