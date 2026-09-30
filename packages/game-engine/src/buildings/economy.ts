import type { Goods, PlayerState } from '../model/state.js';
import { isBuildingActive } from './activation.js';
export function marketChoices(player:PlayerState) {
 return (isBuildingActive(player,'small-market')?[false,true]:[false]).flatMap(useSmallMarket=>
  (isBuildingActive(player,'large-market')?[false,true]:[false]).map(useLargeMarket=>
   ({useSmallMarket,useLargeMarket,income:Number(useSmallMarket)+2*Number(useLargeMarket)})));
}
export function factoryIncome(output:Goods):number {
 return [0,0,1,2,3,5][Object.values(output).filter(count=>count>0).length]!;
}
export function factoryChoices(player:PlayerState,output:Goods):boolean[] {
 return isBuildingActive(player,'factory') && Number.isSafeInteger(player.coins+factoryIncome(output))?[false,true]:[false];
}
