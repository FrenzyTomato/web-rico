import { expect,it } from 'vitest';
import { fireStationBonus, residenceBonus, fortressBonus } from '../../src/buildings/scoringAssets.js';
import { createId } from '../../src/index.js';
import type { BuildingType } from '../../src/index.js';
import { fixture } from '../helpers/state.js';
function player(types:readonly BuildingType[],active=true){
 const p=fixture().players[0]!;
 p.buildings=types.map((type,i)=>({instanceId:createId('building',`b${i}`),buildingTypeId:type,occupiedSlots:i===0?Number(active):0}));
 return p;
}
it.each([false,true])('B-19: Fire Station counts unoccupied small and large production, active=%s',active=>{
 const p=player(['fire-station','small-fruit-depot','large-fruit-depot','large-coffee-roaster','large-sugar-mill','small-market'],active);
 expect(fireStationBonus(p)).toBe(active?7:0);
});
it('B-19: all six production types contribute 10, commercial buildings contribute zero',()=>{
 expect(fireStationBonus(player(['fire-station','small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill','large-tobacco-storage','large-coffee-roaster','residence']))).toBe(10);
});
it.each([[1,4],[9,4],[10,5],[11,6],[12,7]])('B-20: %i Countryside tiles give %i, including empty Quarries',(tiles,expected)=>{
 const p=player(['residence']);
 p.countryside=Array.from({length:tiles},(_,i)=>({instanceId:createId('tile',`t${i}`),kind:i===0?'quarry':'corn',occupied:false}));
 expect(residenceBonus(p)).toBe(expected);
 p.buildings[0]!.occupiedSlots=0;expect(residenceBonus(p)).toBe(0);
});
it.each([[8,2],[9,3],[10,3]])('B-21: %i workers including idle give %i',(workers,expected)=>{
 const p=player(['fortress','large-fruit-depot']);
 p.buildings[1]!.occupiedSlots=3;p.countryside[0]!.occupied=true;p.idleWorkerCount=workers-5;
 expect(fortressBonus(p)).toBe(expected);
 p.buildings[0]!.occupiedSlots=0;p.idleWorkerCount++;expect(fortressBonus(p)).toBe(0);
});
it('unowned scoring buildings give zero without mutating the player',()=>{
 const p=player(['small-market']);const before=JSON.stringify(p);
 expect([fireStationBonus(p),residenceBonus(p),fortressBonus(p)]).toEqual([0,0,0]);
 expect(JSON.stringify(p)).toBe(before);
});
