import { cylinder, material } from './resources.js';
import { WorkerMedallion } from './WorkerMedallion.js';
import { Model } from './Model.js';
import { Selectable } from './Selectable.js';

/** Occupied workers and subtle empty sockets; IDs identify owned instances, never market stock. */
export function Workers({ count, capacity, y = 0.1, owner, columns = capacity, spacing = 0.29, scale = 1, slotRow = false }: {
  count: number; capacity: number; y?: number; owner?: string; columns?: number; spacing?: number; scale?: number; slotRow?: boolean;
}) {
  const cols = Math.max(1, Math.min(columns, capacity));
  return <>{Array.from({ length: capacity }, (_, i) => {
    const body = <group scale={scale}>
      {slotRow ? i >= count && <WorkerMedallion /> : <mesh dispose={null} geometry={cylinder(0.12, 0.025)} material={material('#ded0a7')} />}
      {i < count ? <Model name={`Worker ${String(i % 5 + 1).padStart(2, '0')}`} width={slotRow ? 0.36 : 0.25} depth={slotRow ? 0.36 : 0.25} height={slotRow ? 0.64 : 0.46} /> :
        !slotRow && <mesh position={[0, 0.015, 0]} dispose={null} geometry={cylinder(0.085, 0.012)} material={material('#948976')} />}
    </group>;
    return <group key={i} position={[(i % cols - (cols - 1) / 2) * spacing, y, Math.floor(i / cols) * spacing]}>
      {owner && i < count ? <Selectable circular={slotRow} target={{ kind: 'worker', id: owner, index: i }} hitHeight={slotRow ? 0.64 : 0.35} size={slotRow ? [0.36, 0.36] : [0.28, 0.28]}>{body}</Selectable> : body}
    </group>;
  })}</>;
}
