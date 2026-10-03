import { BUILDING_MARKET_ORIGIN } from './pieces.js';
import type { PlayerView } from '@vibe-rico/protocol';
import { BuildingMarket, EstateMarket, SupplyRow, WorkerSupply } from './Markets.js';
import { Ships } from './Ships.js';

/** Harbour above, estates left, buildings below; role selection lives in the bottom dock. */
export function CommonBoard({ view }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  return <group>
    <group position={[0.6, 0, -6.2]}><Ships ships={view.ships} tradingHouse={view.tradingHouse} /></group>
    <group position={[-17, 0, -9.5]}><SupplyRow supply={view.supply} /></group>
    <group position={[23, 0, -6]}><WorkerSupply supply={view.supply} /></group>
    <group position={[-20, 0, 0.5]}><EstateMarket market={view.estateMarket} discard={view.estateDiscard.length} quarries={view.supply.quarryCount} /></group>
    <group position={[BUILDING_MARKET_ORIGIN.x, 0, BUILDING_MARKET_ORIGIN.z]}><BuildingMarket stock={view.supply.buildingStock} /></group>
  </group>;
}
