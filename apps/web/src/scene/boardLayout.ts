import { BUILDINGS } from '@vibe-rico/game-engine';
import type { BuildingInstance, CountrysideTile } from '@vibe-rico/game-engine';

export const GRID = { cols: 4, rows: 3 } as const;

/** Twelve Countryside spaces (4×3); tiles fill them in placement order, keyed by instance ID. */
export function fieldSlots(countryside: readonly CountrysideTile[]) {
  return Array.from({ length: GRID.cols * GRID.rows }, (_, i) => ({ col: i % GRID.cols, row: Math.floor(i / GRID.cols), tile: countryside[i] ?? null }));
}

/**
 * Twelve City spaces (4×3). Buildings fill them in build order using their catalog footprint; a
 * two-space building never wraps across rows (it moves to the next row). Worker slots come from the catalog.
 */
export function citySlots(buildings: readonly BuildingInstance[]) {
  let col = 0, row = 0;
  return buildings.map(building => {
    const { footprint, workerSlots } = BUILDINGS[building.buildingTypeId];
    if (col + footprint > GRID.cols) { col = 0; row++; }
    const placed = { building, col, row, span: footprint, workerSlots };
    col += footprint;
    if (col >= GRID.cols) { col = 0; row++; }
    return placed;
  });
}
