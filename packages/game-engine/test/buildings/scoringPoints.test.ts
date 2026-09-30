import { expect,it } from 'vitest';
import { customsHouseBonus, cityHallBonus } from '../../src/buildings/scoringPoints.js';
import { createId } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
it.each([[7,1],[8,2],[30,7]])('B-22: %i earned VP gives %i, excluding building points',(earned,expected)=>{
 const p=fixture().players[0]!;p.earnedVp=earned;
 p.buildings=[{instanceId:createId('building','customs'),buildingTypeId:'customs-house',occupiedSlots:1},{instanceId:createId('building','residence'),buildingTypeId:'residence',occupiedSlots:0}];
 expect(customsHouseBonus(p)).toBe(expected);
 p.buildings[0]!.occupiedSlots=0;expect(customsHouseBonus(p)).toBe(0);
});
it('B-23: counts three commercial tiles including itself, not production or footprint',()=>{
 const p=fixture().players[0]!;
 p.buildings=(['city-hall','fire-station','small-market','large-fruit-depot','small-sugar-mill'] as const).map((buildingTypeId,i)=>({instanceId:createId('building',`b${i}`),buildingTypeId,occupiedSlots:Number(i===0)}));
 const before=JSON.stringify(p);expect(cityHallBonus(p)).toBe(3);expect(JSON.stringify(p)).toBe(before);
 p.buildings[0]!.occupiedSlots=0;expect(cityHallBonus(p)).toBe(0);
});
it('unowned Customs House and City Hall give zero',()=>{
 const p=fixture().players[0]!;p.earnedVp=30;
 expect(customsHouseBonus(p)).toBe(0);expect(cityHallBonus(p)).toBe(0);
});
