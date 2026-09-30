import type { PlayerView } from '@vibe-rico/protocol';
import { BuildingMarket, EstateMarket, SupplyRow } from './Markets.js';
import { RoleTiles } from './RoleTiles.js';
import { Ships } from './Ships.js';

/** The shared harbour in the table centre (DESIGN.md "Scene style"); reads only PlayerView. */
export function CommonBoard({ view, names }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  return (
    <group>
      <group position={[-2.2, 0, -4.6]}><Ships ships={view.ships} tradingHouse={view.tradingHouse} /></group>
      <group position={[0, 0, -2.0]}><RoleTiles cards={view.roleCards} names={names} /></group>
      <group position={[-8.2, 0, 0.6]}>
        <EstateMarket market={view.estateMarket} discard={view.estateDiscard.length} quarries={view.supply.quarryCount} />
      </group>
      <group position={[0.8, 0, 0.6]}><SupplyRow supply={view.supply} /></group>
      <group position={[-7.35, 0, 2.3]}><BuildingMarket stock={view.supply.buildingStock} /></group>
    </group>
  );
}
