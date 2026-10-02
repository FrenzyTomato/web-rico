import { BUILDINGS } from '@vibe-rico/game-engine';
import type { CountrysideTile, BuildingType } from '@vibe-rico/game-engine';

/** Canonical RULES.md RECRUITER-002 and BUILDING-001–023; never duplicate building capacities. */
export const ESTATE_WORKER_SLOTS: Record<CountrysideTile['kind'], number> = {
  corn: 1, fruit: 1, sugar: 1, tobacco: 1, coffee: 1, quarry: 1,
};
export const buildingWorkerSlots = (type: BuildingType) => BUILDINGS[type].workerSlots;
