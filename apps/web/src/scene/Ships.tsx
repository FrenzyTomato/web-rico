import type { CargoShip, Good } from '@vibe-rico/game-engine';
import { GOOD } from '../i18n/terms.js';
import { Label } from './Label.js';
import { GOOD_COLOR, shipSlots, tradingSlots } from './pieces.js';

function Crates({ slots, spacing }: { slots: (Good | null)[]; spacing: number }) {
  const start = -((slots.length - 1) * spacing) / 2;
  return <>{slots.map((good, i) => (
    <mesh key={i} position={[start + i * spacing, 0.45, 0]}>
      {good ? <cylinderGeometry args={[0.22, 0.22, 0.45, 12]} /> : <cylinderGeometry args={[0.2, 0.2, 0.04, 12]} />}
      <meshStandardMaterial color={good ? GOOD_COLOR[good] : '#d8ccb0'} />
    </mesh>
  ))}</>;
}

/** Cargo ships at the dock and the Trading House; every slot is drawn so full and empty are countable. */
export function Ships({ ships, tradingHouse }: { ships: readonly CargoShip[]; tradingHouse: readonly Good[] }) {
  return (
    <group>
      {ships.map((ship, i) => (
        <group key={ship.instanceId} position={[(i - (ships.length - 1) / 2) * 4, 0, 0]}>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[ship.capacity * 0.5 + 0.4, 0.3, 1]} />
            <meshStandardMaterial color="#6b4a2f" />
          </mesh>
          <Crates slots={shipSlots(ship)} spacing={0.5} />
          <Label position={[0, 1.3, 0]} text={`${ship.goodType ? GOOD[ship.goodType] : '空船'} ${ship.loadedCount}/${ship.capacity}`} />
        </group>
      ))}
      <group position={[(ships.length + 0.6) * 2.2, 0, 0]}>
        <mesh position={[0, 0.15, 0]}><boxGeometry args={[2.4, 0.3, 1.2]} /><meshStandardMaterial color="#a67c52" /></mesh>
        <Crates slots={tradingSlots(tradingHouse)} spacing={0.55} />
        <Label position={[0, 1.3, 0]} text={`交易所 ${tradingHouse.length}/4`} />
      </group>
    </group>
  );
}
