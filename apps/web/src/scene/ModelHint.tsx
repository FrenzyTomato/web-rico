import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import type { PieceHint } from './effects.js';

export const HoverHint = createContext<(hint: PieceHint | null) => void>(() => {});
/** Cheap hover footprint works independently of selection and the detailed model triangles. */
export function ModelHint({ hint, size, children }: { hint: PieceHint; size: [number, number]; children: ReactNode }) {
  const show = useContext(HoverHint);
  return <group onPointerOver={() => show(hint)} onPointerOut={() => show(null)}>
    <mesh position={[0, 0.3, 0]}><boxGeometry args={[size[0], 0.6, size[1]]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} /></mesh>
    {children}
  </group>;
}
