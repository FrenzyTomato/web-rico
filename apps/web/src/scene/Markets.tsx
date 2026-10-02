import { t, useLanguage } from '../i18n/language.js';
import { BUILDINGS } from '@vibe-rico/game-engine';
import type { EstateTile, Goods, Supply } from '@vibe-rico/game-engine';
import { BUILDING, GOOD, TILE } from '../i18n/terms.js';
import { Label } from './Label.js';
import { Selectable } from './Selectable.js';
import { Model } from './Model.js';
import { BUILDING_MODEL, ESTATE_MODEL, GOODS_MODEL } from './modelCatalog.js';
import { Workers } from './Workers.js';
import { buildingMarket } from './pieces.js';
import { box, material } from './resources.js';
import { buildingHint, estateHint } from './effects.js';

export function EstateMarket({ market, discard, quarries }: { market: readonly EstateTile[]; discard: number; quarries: number }) {
  useLanguage();
  return <group>
    {market.map((tile, i) => <group key={tile.instanceId} position={[i % 3 * 2.5, 0, Math.floor(i / 3) * 2.5]}>
      <Selectable hint={estateHint(tile.kind)} target={{ kind: 'estate', id: tile.instanceId }} size={[2.1, 1.8]}>
          <Model name={ESTATE_MODEL[tile.kind]} width={2.1} depth={1.8} height={2.2} />
          <Label position={[0, 0.1, 0.98]} height={0.62} maxWidth={2.3} text={TILE[tile.kind]} />

      </Selectable>
    </group>)}
    <group position={[market.length % 3 * 2.5, 0, Math.floor(market.length / 3) * 2.5]}>
      <Selectable hint={estateHint('quarry')} target={{ kind: 'quarry' }} size={[2.1, 1.8]}>
          {quarries > 0 && <Model name="Quarry" width={2.1} depth={1.8} height={2.2} />}
          <Label position={[0, 0.1, 0.98]} height={0.62} maxWidth={2.3} text={t("采石场 ×{0}", [quarries])} />

      </Selectable>
    </group>
    <Label position={[2.5, 0.1, Math.ceil((market.length + 1) / 3) * 2.5 + 1.2]} height={0.62} text={t("弃牌：{0}", [discard])} />
  </group>;
}

/** The left-hand supply column uses large goods models and counts, not decorative barrels. */
export function SupplyRow({ supply }: { supply: Supply }) {
  useLanguage();
  const goods = Object.entries(supply.goods) as [keyof Goods, number][];
  return <group>{goods.map(([good, count], i) => <group key={good} position={[0, 0, i * 1.4]}>
    <Model name={GOODS_MODEL[good]} width={1.15} height={1.1} muted={count === 0} />
    <Label position={[1.45, 0.1, 0.25]} height={0.68} text={`${GOOD[good]}：${count}`} />
  </group>)}</group>;
}
export function WorkerSupply({ supply }: { supply: Supply }) {
  useLanguage();
  return <group>
    <Workers count={supply.workRegisterCount} capacity={supply.workRegisterCount} columns={5} spacing={0.9} scale={3} />
    <Label position={[0, 0.1, Math.ceil(supply.workRegisterCount / 5) * 0.9 - 1.5]} height={0.68} text={t("可招募工人：{0}", [supply.workRegisterCount])} />
  </group>;
}
/** One price per column; a price group may span columns, each with up to three buildings. */
export function BuildingMarket({ stock }: { stock: Supply['buildingStock'] }) {
  useLanguage();
  const groups = new Map<number, ReturnType<typeof buildingMarket>>();
  for (const item of buildingMarket(stock)) {
    const price = BUILDINGS[item.type].cost;
    const group = groups.get(price) ?? [];
    group.push(item);
    groups.set(price, group);
  }
  let nextX = 0;
  return <group>{[...groups].map(([price, buildings]) => {
    const columns = Math.ceil(buildings.length / 3);
    const x = nextX;
    nextX += columns * 2.55 + 0.22;
    const centre = (columns - 1) * 2.55 / 2;
    return <group key={price} position={[x, 0, 0]}>
      {buildings.map(({ type, count, exhausted }, i) => <group key={type} position={[Math.floor(i / 3) * 2.55, 0, i % 3 * 2.7]}>
        <Selectable hint={buildingHint(type)} target={{ kind: 'building', type }} size={[2.3, 1.8]}>
          <Model name={BUILDING_MODEL[type]} width={2.3} depth={1.8} height={2.2} muted={exhausted} />
          <Label position={[0, 0.1, 0.98]} height={0.68} maxWidth={2.45} ink={exhausted ? '#8f8778' : '#2a2118'} text={`${BUILDING[type]} ×${count}`} />
        </Selectable>
      </group>)}
      <mesh position={[centre, 0.025, -1.15]} dispose={null} geometry={box((columns - 1) * 2.55 + 2.1, 0.02, 0.025)} material={material('#aa946b')} />
      <Label position={[centre, 0.1, -1.7]} height={0.95} text={`🪙 ${price}`} />
    </group>;
  })}</group>;
}
