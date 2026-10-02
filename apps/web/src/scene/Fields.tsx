import { useLanguage } from '../i18n/language.js';
import type { CountrysideTile } from '@vibe-rico/game-engine';
import { ModelHint } from './ModelHint.js';
import { estateHint } from './effects.js';
import { TILE } from '../i18n/terms.js';
import { Label } from './Label.js';
import { fieldSlots } from './boardLayout.js';
import { Workers } from './Workers.js';
import { Selectable } from './Selectable.js';
import { Model } from './Model.js';
import { ESTATE_MODEL } from './modelCatalog.js';
import { ESTATE_WORKER_SLOTS } from './workerSlots.js';
import { CELL, ROW } from './Mat.js';
export { CELL } from './Mat.js';

/** The Countryside: 12 spaces; quarries are taller grey blocks, plantations flat tiles in their goods colour. */
export function Fields({ countryside, mine = false }: { countryside: readonly CountrysideTile[]; mine?: boolean }) {
  useLanguage();
  return <>{fieldSlots(countryside).map(({ col, row, tile }) => {
    const body = <>
      {tile && <Model name={ESTATE_MODEL[tile.kind]} width={CELL - 0.03} depth={1.4} height={1.65} />}
      {tile && <>
        <Label position={[0, 0.04, 1.16]} height={0.34} maxWidth={CELL - 0.04} text={TILE[tile.kind]} />
        <group position={[0, 0.025, 0.96]}><Workers slotRow spacing={0.38} count={Number(tile.occupied)} capacity={ESTATE_WORKER_SLOTS[tile.kind]} y={0} {...(mine ? { owner: tile.instanceId } : {})} /></group>
      </>}
    </>;
    return (
      <group key={tile?.instanceId ?? `empty-${col}-${row}`} position={[col * CELL, 0, row * ROW]}>
        {/* Only the viewer's own tiles can be targets (Hospital placement). */}
        {mine && tile ? <Selectable hint={estateHint(tile.kind)} target={{ kind: 'tile', id: tile.instanceId }} size={[CELL - 0.08, CELL - 0.08]}>{body}</Selectable> : tile ? <ModelHint hint={estateHint(tile.kind)} size={[CELL, 1.4]}>{body}</ModelHint> : body}
      </group>
    );
  })}</>;
}
