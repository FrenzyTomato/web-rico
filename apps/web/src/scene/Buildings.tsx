import { useLanguage } from '../i18n/language.js';
import type { BuildingInstance } from '@vibe-rico/game-engine';
import { BUILDING } from '../i18n/terms.js';
import { citySlots } from './boardLayout.js';
import { CELL, ROW } from './Mat.js';
import { ModelHint } from './ModelHint.js';
import { buildingHint } from './effects.js';
import { Label } from './Label.js';
import { Selectable } from './Selectable.js';
import { Workers } from './Workers.js';
import { Model } from './Model.js';
import { BUILDING_MODEL } from './modelCatalog.js';

/** The City: 12 spaces in build order; each building shows its name, and workers against its catalog slots. */
export function Buildings({ buildings, mine = false }: { buildings: readonly BuildingInstance[]; mine?: boolean }) {
  useLanguage();
  return <>{citySlots(buildings).map(({ building, col, row, span, workerSlots }) => {
    const body = <>
      <Model name={BUILDING_MODEL[building.buildingTypeId]} width={span * CELL - 0.03} depth={1.4} height={1.65} />
      <group position={[0, 0.025, 0.96]}><Workers slotRow spacing={0.38} count={building.occupiedSlots} capacity={workerSlots} y={0} {...(mine ? { owner: building.instanceId } : {})} /></group>
      <Label position={[0, 0.04, 1.16]} height={0.34} maxWidth={span * CELL - 0.04} text={BUILDING[building.buildingTypeId]} />
    </>;
    return <group key={building.instanceId} position={[(col + (span - 1) / 2) * CELL, 0, row * ROW]}>
      {mine ? <Selectable hint={buildingHint(building.buildingTypeId)} target={{ kind: 'owned-building', id: building.instanceId }} size={[span * CELL - 0.08, CELL - 0.08]}>{body}</Selectable> : <ModelHint hint={buildingHint(building.buildingTypeId)} size={[span * CELL, 1.4]}>{body}</ModelHint>}
    </group>;
  })}</>;
}
