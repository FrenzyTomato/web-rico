import type { BuildingInstance } from '@vibe-rico/game-engine';
import { BUILDING } from '../i18n/terms.js';
import { citySlots } from './boardLayout.js';
import { CELL } from './Fields.js';
import { Label } from './Label.js';
import { Workers } from './Workers.js';

/** The City: 12 spaces in build order; each building shows its name, and workers against its catalog slots. */
export function Buildings({ buildings }: { buildings: readonly BuildingInstance[] }) {
  return <>{citySlots(buildings).map(({ building, col, row, span, workerSlots }) => (
    <group key={building.instanceId} position={[(col + (span - 1) / 2) * CELL, 0, row * CELL]}>
      <mesh position={[0, 0.18, 0]}>
        <boxGeometry args={[span * CELL - 0.08, 0.36, CELL - 0.08]} />
        <meshStandardMaterial color={span === 2 ? '#8e5b3a' : '#b08d5b'} />
      </mesh>
      <group position={[0, 0.2, 0.18]}><Workers count={building.occupiedSlots} capacity={workerSlots} /></group>
      <Label position={[0, 0.75, -0.1]} height={0.26} text={BUILDING[building.buildingTypeId]} />
    </group>
  ))}</>;
}
