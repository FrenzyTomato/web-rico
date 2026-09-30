import { BUILDINGS } from '../buildings/definitions.js';
import type { BuildingType, Good, Role } from '../model/state.js';

// S3 pp.3–8; building multiplicities are user-supplied PROJECT-003.
export const PLAYER_CONFIG = {
  3:{coins:2,workers:55,vp:75,ships:[4,5,6],starting:['fruit','fruit','corn']},
  4:{coins:3,workers:75,vp:100,ships:[5,6,7],starting:['fruit','fruit','corn','corn']},
  5:{coins:4,workers:95,vp:126,ships:[6,7,8],starting:['fruit','fruit','fruit','corn','corn']},
} as const;
export const GOODS: Readonly<Record<Good,number>> = {corn:10,fruit:11,sugar:11,tobacco:9,coffee:9};
// Ordered input to the versioned shuffle; changing this order changes seeded setup.
export const ESTATES: readonly (readonly [Good,number])[] = [['corn',10],['fruit',12],['sugar',11],['tobacco',9],['coffee',8]];
export const BASE_ROLES: readonly Role[] = ['planter','recruiter','builder','craftsman','trader','captain'];
export const BUILDING_STOCK: Readonly<Record<BuildingType,number>> = Object.freeze(
  Object.fromEntries(Object.entries(BUILDINGS).map(([type,b])=>[type,b.stock])) as Record<BuildingType,number>,
);
