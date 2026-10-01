import type { CountrysideTile } from '@vibe-rico/game-engine';
import { Label } from './Label.js';
import { fieldSlots } from './boardLayout.js';
import { GOOD_COLOR, QUARRY_COLOR } from './pieces.js';
import { Workers } from './Workers.js';
import { Selectable } from './Selection.js';

// A one-character mark per tile type, so colour is never the only cue (DESIGN.md).
const MARK = { corn: '玉', fruit: '果', sugar: '糖', tobacco: '烟', coffee: '咖', quarry: '石' } as const;
export const CELL = 0.8;

/** The Countryside: 12 spaces; quarries are taller grey blocks, plantations flat tiles in their goods colour. */
export function Fields({ countryside, mine = false }: { countryside: readonly CountrysideTile[]; mine?: boolean }) {
  return <>{fieldSlots(countryside).map(({ col, row, tile }) => {
    const body = <>
      <mesh position={[0, tile?.kind === 'quarry' ? 0.12 : 0.04, 0]}>
        <boxGeometry args={[CELL - 0.08, tile?.kind === 'quarry' ? 0.24 : 0.08, CELL - 0.08]} />
        <meshStandardMaterial color={tile ? (tile.kind === 'quarry' ? QUARRY_COLOR : GOOD_COLOR[tile.kind]) : '#e4d8bb'} />
      </mesh>
      {tile && <>
        <Label position={[0, 0.5, -0.1]} height={0.28} text={MARK[tile.kind]} />
        {tile.occupied && <Workers count={1} capacity={1} y={0.3} />}
      </>}
    </>;
    return (
      <group key={tile?.instanceId ?? `empty-${col}-${row}`} position={[col * CELL, 0, row * CELL]}>
        {/* Only the viewer's own tiles can be targets (Hospital placement). */}
        {mine && tile ? <Selectable target={{ kind: 'tile', id: tile.instanceId }} size={[CELL - 0.08, CELL - 0.08]}>{body}</Selectable> : body}
      </group>
    );
  })}</>;
}
