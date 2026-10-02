import { buildingWorkerSlots } from './workerSlots.js';
import { BUILDINGS } from '@vibe-rico/game-engine';
import type { BuildingInstance, CountrysideTile } from '@vibe-rico/game-engine';

export const GRID = { cols: 6, rows: 2 } as const;

/** Twelve Countryside spaces (6×2); tiles fill them in placement order, keyed by instance ID. */
export function fieldSlots(countryside: readonly CountrysideTile[]) {
  return Array.from({ length: GRID.cols * GRID.rows }, (_, i) => ({ col: i % GRID.cols, row: Math.floor(i / GRID.cols), tile: countryside[i] ?? null }));
}

/**
 * Twelve City spaces (6×2). Buildings fill them in build order using their catalog footprint; a
 * two-space building never wraps across rows. Later buildings backfill gaps. Worker slots come from the catalog.
 */
export function citySlots(buildings: readonly BuildingInstance[]) {
  const occupied = Array<boolean>(GRID.cols * GRID.rows).fill(false);
  return buildings.map(building => {
    const { footprint } = BUILDINGS[building.buildingTypeId];
    const index = occupied.findIndex((used, i) => !used && i % GRID.cols + footprint <= GRID.cols
      && occupied.slice(i, i + footprint).every(slot => !slot));
    if (index < 0) throw new Error('City exceeds its twelve spaces');
    occupied.fill(true, index, index + footprint);
    return { building, col: index % GRID.cols, row: Math.floor(index / GRID.cols), span: footprint, workerSlots: buildingWorkerSlots(building.buildingTypeId) };
  });
}
