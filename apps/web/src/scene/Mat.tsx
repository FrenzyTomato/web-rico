import { t, useLanguage } from '../i18n/language.js';
import { Island } from './Environment.js';
import { Label } from './Label.js';

// Logical placement dimensions stay unchanged: two rows of six in each district.
export const CELL = 1.45;
export const ROW = 2.1;
export const BOARD = { width: 9.8, depth: 11 } as const;
export const ESTATE_X = -3.625, CITY_X = -3.625, GRID_Z = -3.5, CITY_Z = 1.4;

export function Mat({ color }: { color: string }) {
  useLanguage();
  return <>
    <Island player />
    <Label position={[-3.65, 0.13, -4.65]} height={0.32} text={t('田园')} ink="#284b39" />
    <Label position={[-3.65, 0.13, 0.35]} height={0.32} text={t('城镇')} ink="#635136" />
    {/* A small seat-colour pennant, not a frame around the island. */}
    <mesh position={[-4.5, 0.5, -5.1]}>
      <boxGeometry args={[0.035, 0.7, 0.035]} /><meshBasicMaterial color="#654b33" />
    </mesh>
    <mesh position={[-4.25, 0.72, -5.1]}>
      <boxGeometry args={[0.45, 0.25, 0.035]} /><meshBasicMaterial color={color} />
    </mesh>
  </>;
}
