import { boatHint, depotHint } from './harbourHints.js';
import { t, useLanguage } from '../i18n/language.js';
import type { CargoShip, Good } from '@vibe-rico/game-engine';
import { GOOD } from '../i18n/terms.js';
import { Label } from './Label.js';
import { Selectable } from './Selectable.js';
import { shipSlots, tradingSlots } from './pieces.js';
import { Model } from './Model.js';
import { GOODS_MODEL } from './modelCatalog.js';
import { BOAT_BAYS, BOAT_FIT, DEPOT_BAYS, DEPOT_FIT } from './harbourSlots.js';
import type { CargoBays } from './harbourSlots.js';
import type { SceneTarget } from './Selection.js';

/** Empty sockets are individual targets; the server still determines the whole shipment quantity. */
function CargoSlots({ slots, bays, shipId }: { slots: (Good | null)[]; bays: CargoBays; shipId?: string }) {
  return <>{slots.map((good, index) => {
    const target: SceneTarget = shipId ? { kind: 'ship-slot', id: shipId, index } : { kind: 'depot-slot', index };
    return <group key={index} position={bays.centres[index]!}>
      {good ? <Model name={GOODS_MODEL[good]} width={bays.size} depth={bays.size} height={bays.size} /> : <Selectable outline hitHeight={0.08} target={target} size={[bays.size, bays.size]} />}
    </group>;
  })}</>;
}
export function Ships({ ships, tradingHouse }: { ships: readonly CargoShip[]; tradingHouse: readonly Good[] }) {
  useLanguage();
  return <group>
    {ships.map((ship, i) => <group key={ship.instanceId} position={[-6 + i * 6, 0, 0]}>
      <Selectable hint={boatHint(ship)} target={{ kind: 'ship', id: ship.instanceId }} size={[3.6, 6.2]}>
        <group rotation={[0, Math.PI / 2, 0]}>
          <Model name={`${ship.capacity}-Slot Boat`} {...BOAT_FIT} />
          <CargoSlots slots={shipSlots(ship)} bays={BOAT_BAYS[ship.capacity]!} shipId={ship.instanceId} />
        </group>
        <Label position={[0, 0.1, -3.8]} height={0.68} text={`${ship.goodType ? GOOD[ship.goodType] : t("空船")} ${ship.loadedCount}/${ship.capacity}`} />
      </Selectable>
    </group>)}
    <group position={[17.4, 0, -1.8]}>
      <Selectable hint={depotHint(tradingHouse)} target={{ kind: 'depot' }} size={[4, 5]}>
        <Model name="Trader Depot" {...DEPOT_FIT} />
        <CargoSlots slots={tradingSlots(tradingHouse)} bays={DEPOT_BAYS} />
        <Label position={[0, 0.1, 3.6]} height={0.68} text={t("交易所 {0}/4", [tradingHouse.length])} />
      </Selectable>
    </group>
  </group>;
}
