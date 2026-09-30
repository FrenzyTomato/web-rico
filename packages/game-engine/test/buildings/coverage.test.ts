import { expect,it } from 'vitest';
import { BUILDINGS } from '../../src/buildings/definitions.js';
import type { BuildingType } from '../../src/index.js';
// Explicit ownership, not inferred from catalog order or printed values.
const coverage={
 'small-fruit-depot':['B-01','PR-019','implemented'],
 'small-sugar-mill':['B-02','PR-019','implemented'],
 'large-fruit-depot':['B-03','PR-019','implemented'],
 'large-sugar-mill':['B-04','PR-019','implemented'],
 'large-tobacco-storage':['B-05','PR-019','implemented'],
 'large-coffee-roaster':['B-06','PR-019','implemented'],
 'small-market':['B-07','PR-027','implemented'],
 hacienda:['B-08','PR-028','implemented'],
 'builders-yard':['B-09','PR-028','implemented'],
 'small-warehouse':['B-10','PR-030','implemented'],
 hospital:['B-11','PR-028','implemented'],
 office:['B-12','PR-027A','implemented'],
 'large-market':['B-13','PR-027','implemented'],
 'large-warehouse':['B-14','PR-030','implemented'],
 factory:['B-15','PR-027','implemented'],
 school:['B-16','PR-029','implemented'],
 harbor:['B-17','PR-030A','implemented'],
 wharf:['B-18','PR-030A','implemented'],
 'fire-station':['B-19','PR-033A','implemented'],
 residence:['B-20','PR-033A','implemented'],
 fortress:['B-21','PR-033A','implemented'],
 'customs-house':['B-22','PR-033B','implemented'],
 'city-hall':['B-23','PR-033B','implemented'],
} as const satisfies Record<BuildingType,readonly [string,string,'implemented']>;
it('maps every catalog type to a distinct B-case and matching rule ID',()=>{
 expect(Object.keys(coverage).sort()).toEqual(Object.keys(BUILDINGS).sort());
 expect(new Set(Object.values(coverage).map(c=>c[0])).size).toBe(23);
 for(const [type,[scenario]] of Object.entries(coverage))expect(BUILDINGS[type as BuildingType].ruleId).toBe(`BUILDING-${scenario.slice(2).padStart(3,'0')}`);
});
it('all 23 building abilities are implemented under their named owners',()=>{
 expect(Object.values(coverage).every(c=>c[2]==='implemented')).toBe(true);
 expect(Object.values(coverage)).toHaveLength(23);
});
