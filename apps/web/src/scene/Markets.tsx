import type { EstateTile, Goods, Supply } from '@vibe-rico/game-engine';
import { BUILDING, GOOD, TILE } from '../i18n/terms.js';
import { Label } from './Label.js';
import { buildingMarket, GOOD_COLOR, QUARRY_COLOR } from './pieces.js';

/** Face-up estates, the Quarry stack, and the discard pile count. */
export function EstateMarket({ market, discard, quarries }: { market: readonly EstateTile[]; discard: number; quarries: number }) {
  return (
    <group>
      {market.map((tile, i) => (
        <group key={tile.instanceId} position={[i * 1.5, 0, 0]}>
          <mesh position={[0, 0.05, 0]}><boxGeometry args={[1.1, 0.1, 1.1]} /><meshStandardMaterial color={GOOD_COLOR[tile.kind]} /></mesh>
          <Label position={[0, 0.7, 0]} height={0.5} text={TILE[tile.kind]} />
        </group>
      ))}
      <group position={[market.length * 1.5 + 0.4, 0, 0]}>
        {Array.from({ length: quarries }, (_, q) => (
          <mesh key={q} position={[0, 0.05 + q * 0.1, 0]}><boxGeometry args={[1.1, 0.08, 1.1]} /><meshStandardMaterial color={QUARRY_COLOR} /></mesh>
        ))}
        <Label position={[0, 1.4, 0]} height={0.5} text={`采石场×${quarries}`} />
      </group>
      <Label position={[market.length * 1.5 + 2.6, 0.7, 0]} height={0.5} text={`弃牌×${discard}`} />
    </group>
  );
}

/** Supplies: a barrel per good with its count, workers, the colonist ship and remaining VP. */
export function SupplyRow({ supply }: { supply: Supply }) {
  const goods = Object.entries(supply.goods) as [keyof Goods, number][];
  return (
    <group>
      {goods.map(([good, count], i) => (
        <group key={good} position={[i * 1.2, 0, 0]}>
          <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.35, 0.35, 0.6, 14]} /><meshStandardMaterial color={count > 0 ? GOOD_COLOR[good] : '#8f8778'} /></mesh>
          <Label position={[0, 1, 0]} height={0.5} text={`${GOOD[good]}${count}`} />
        </group>
      ))}
      <Label position={[goods.length * 1.2 + 0.6, 0.6, -0.4]} height={0.5} text={`工人${supply.workerCount} 船${supply.workRegisterCount}`} />
      <Label position={[goods.length * 1.2 + 0.6, 0.6, 0.4]} height={0.5} text={`分数${supply.vpRemaining}`} />
    </group>
  );
}

/** Every building type in catalog order with its remaining stock; sold-out types stay visible, greyed. */
export function BuildingMarket({ stock }: { stock: Supply['buildingStock'] }) {
  return (
    <group>
      {buildingMarket(stock).map(({ type, count, exhausted }, i) => {
        const col = i % 8, row = Math.floor(i / 8);
        return (
          <group key={type} position={[col * 2.1, 0, row * 1.2]}>
            <mesh position={[0, 0.15, 0]}><boxGeometry args={[1, 0.3, 0.8]} /><meshStandardMaterial color={exhausted ? '#6f685e' : '#b08d5b'} /></mesh>
            <Label position={[0, 0.65, 0]} height={0.45} ink={exhausted ? '#8f8778' : '#2a2118'} text={`${BUILDING[type]}×${count}`} />
          </group>
        );
      })}
    </group>
  );
}
