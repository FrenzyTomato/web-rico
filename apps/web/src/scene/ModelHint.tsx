import { useTouchHint } from './useTouchHint.js';
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { PieceHint } from './effects.js';
import { Interaction } from './Selection.js';

export const HoverHint = createContext<(hint: PieceHint | null) => void>(() => {});
/** Cheap hover footprint works independently of selection and the detailed model triangles. */
export function ModelHint({ hint, size, children }: { hint: PieceHint; size: [number, number]; children: ReactNode }) {
  const context = useContext(HoverHint);
  const interaction = useContext(Interaction);
  const show = (next: PieceHint | null) => { if (!next || !interaction.inspect || interaction.inspect(null)) context(next); };
  const touch = useTouchHint(() => show(hint));
  return <group onClick={e => { if (interaction.inspect) e.stopPropagation(); }} onPointerOver={e => { if (!touch.isTouch(e)) show(hint); }}
    onPointerDown={e => { if (touch.isTouch(e)) { e.stopPropagation(); touch.down(e); } }}
    onPointerOut={e => { if (touch.isTouch(e)) touch.cancel(); else show(null); }}>

    <mesh position={[0, 0.3, 0]}><boxGeometry args={[size[0], 0.6, size[1]]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    {children}
  </group>;
}
