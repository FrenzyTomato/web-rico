import { expect,it } from 'vitest';
import { BUILDINGS,BUILDING_STOCK_SOURCE } from '../../src/buildings/definitions.js';
import type { BuildingType } from '../../src/index.js';
// Independent literal expectations from B-01–23: cost/VP/footprint/slots/Quarry cap/stock.
const expected:Record<BuildingType,readonly number[]>={
 'small-fruit-depot':[1,1,1,1,1,4],'small-sugar-mill':[2,1,1,1,1,4],
 'large-fruit-depot':[3,2,1,3,2,3],'large-sugar-mill':[4,2,1,3,2,3],
 'large-tobacco-storage':[5,3,1,3,3,3],'large-coffee-roaster':[6,3,1,2,3,3],
 'small-market':[1,1,1,1,1,2],hacienda:[2,1,1,1,1,2],'builders-yard':[2,1,1,1,1,2],
 'small-warehouse':[3,1,1,1,1,2],hospital:[4,2,1,1,2,2],office:[5,2,1,1,2,2],
 'large-market':[5,2,1,1,2,2],'large-warehouse':[6,2,1,1,2,2],factory:[7,3,1,1,3,2],
 school:[8,3,1,1,3,2],harbor:[8,3,1,1,3,2],wharf:[9,3,1,1,3,2],
 'fire-station':[10,4,2,1,4,1],residence:[10,4,2,1,4,1],fortress:[10,4,2,1,4,1],
 'customs-house':[10,4,2,1,4,1],'city-hall':[10,4,2,1,4,1],
};
it.each(Object.entries(expected))('%s matches its printed values and project stock', (id,tuple)=>{
 const b=BUILDINGS[id as BuildingType];expect([b.cost,b.baseVp,b.footprint,b.workerSlots,b.quarryCap,b.stock]).toEqual(tuple);
});
it('has exactly23 distinct types,20/24/5 tiles, and explicit stock provenance',()=>{
 expect(Object.keys(BUILDINGS).sort()).toEqual(Object.keys(expected).sort());
 const entries=Object.values(BUILDINGS);
 expect(entries).toHaveLength(23);expect(new Set(entries.map(b=>b.ruleId)).size).toBe(23);
 expect(entries.map(b=>b.ruleId)).toEqual(Array.from({length:23},(_,i)=>`BUILDING-${String(i+1).padStart(3,'0')}`));
 expect([entries.slice(0,6),entries.slice(6,18),entries.slice(18)].map(group=>group.reduce((n,b)=>n+b.stock,0))).toEqual([20,24,5]);
 expect(entries.reduce((n,b)=>n+b.stock,0)).toBe(49);expect(BUILDING_STOCK_SOURCE).toBe('PROJECT-003');
 expect(Object.isFrozen(BUILDINGS)).toBe(true);expect(entries.every(Object.isFrozen)).toBe(true);
});
