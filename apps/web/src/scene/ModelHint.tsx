import { useTouchHint } from './useTouchHint.js';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { PieceHint } from './effects.js';

export const HoverHint = createContext<(hint: PieceHint | null) => void>(() => {});
/** Cheap hover footprint works independently of selection and the detailed model triangles. */
export function ModelHint({ hint, size, children }: { hint: PieceHint; size: [number, number]; children: ReactNode }) {
  const show = useContext(HoverHint);
  const touch = useTouchHint(() => show(hint));
  return <group onPointerOver={e => { if (!touch.isTouch(e)) show(hint); }}
    onPointerDown={e => { if (touch.isTouch(e)) { e.stopPropagation(); touch.down(e); } }}
    onPointerOut={e => { if (touch.isTouch(e)) touch.cancel(); else show(null); }}>

    <mesh position={[0, 0.3, 0]}><boxGeometry args={[size[0], 0.6, size[1]]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    {children}
  </group>;
}
