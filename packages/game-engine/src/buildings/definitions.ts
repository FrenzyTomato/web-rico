import type { BuildingType } from '../model/state.js';

export interface BuildingDefinition {
 readonly ruleId:string;
 readonly cost:number;
 readonly baseVp:number;
 readonly footprint:1|2;
 readonly workerSlots:number;
 readonly quarryCap:number;
 readonly stock:number;
}
// Printed values: canonical S3 pp.18–22, reconciled in docs/RULES.md.
// Multiplicities are user-supplied, not a publisher-verified S3 inventory.
export const BUILDING_STOCK_SOURCE='PROJECT-003' as const;
function definition(ruleId:string,cost:number,baseVp:number,footprint:1|2,workerSlots:number,quarryCap:number,stock:number):BuildingDefinition {
 return Object.freeze({ruleId,cost,baseVp,footprint,workerSlots,quarryCap,stock});
}
export const BUILDINGS:Readonly<Record<BuildingType,BuildingDefinition>>=Object.freeze({
 'small-fruit-depot':definition('BUILDING-001',1,1,1,1,1,4),
 'small-sugar-mill':definition('BUILDING-002',2,1,1,1,1,4),
 'large-fruit-depot':definition('BUILDING-003',3,2,1,3,2,3),
 'large-sugar-mill':definition('BUILDING-004',4,2,1,3,2,3),
 'large-tobacco-storage':definition('BUILDING-005',5,3,1,3,3,3),
 'large-coffee-roaster':definition('BUILDING-006',6,3,1,2,3,3),
 'small-market':definition('BUILDING-007',1,1,1,1,1,2),
 'hacienda':definition('BUILDING-008',2,1,1,1,1,2),
 'builders-yard':definition('BUILDING-009',2,1,1,1,1,2),
 'small-warehouse':definition('BUILDING-010',3,1,1,1,1,2),
 'hospital':definition('BUILDING-011',4,2,1,1,2,2),
 'office':definition('BUILDING-012',5,2,1,1,2,2),
 'large-market':definition('BUILDING-013',5,2,1,1,2,2),
 'large-warehouse':definition('BUILDING-014',6,2,1,1,2,2),
 'factory':definition('BUILDING-015',7,3,1,1,3,2),
 'school':definition('BUILDING-016',8,3,1,1,3,2),
 'harbor':definition('BUILDING-017',8,3,1,1,3,2),
 'wharf':definition('BUILDING-018',9,3,1,1,3,2),
 'fire-station':definition('BUILDING-019',10,4,2,1,4,1),
 'residence':definition('BUILDING-020',10,4,2,1,4,1),
 'fortress':definition('BUILDING-021',10,4,2,1,4,1),
 'customs-house':definition('BUILDING-022',10,4,2,1,4,1),
 'city-hall':definition('BUILDING-023',10,4,2,1,4,1),
});

/** Base-game production classification, independent of footprint and workers. */
export const PRODUCTION_BUILDINGS:readonly BuildingType[] = Object.freeze([
 'small-fruit-depot','small-sugar-mill','large-fruit-depot','large-sugar-mill',
 'large-tobacco-storage','large-coffee-roaster',
]);
