import { t, useLanguage } from '../i18n/language.js';
import { BUILDINGS } from '@vibe-rico/game-engine';
import type { EstateTile, Goods, Supply } from '@vibe-rico/game-engine';
import { BUILDING, GOOD, TILE } from '../i18n/terms.js';
import { Label } from './Label.js';
import { Selectable } from './Selectable.js';
import { Model } from './Model.js';
import { BUILDING_MODEL, ESTATE_MODEL, GOODS_MODEL } from './modelCatalog.js';
import { Workers } from './Workers.js';
import { compactBuildingTiers } from './pieces.js';
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
    <Label position={[0, 0.1, -1.8]} height={0.68} text={t("可招募工人：{0}", [supply.workRegisterCount])} />
  </group>;
}
/** Compact discount groups with an individual price below every building name. */
export function BuildingMarket({ stock }: { stock: Supply['buildingStock'] }) {
  useLanguage();
  return <group>{compactBuildingTiers().map(tier => <group key={tier.cap}>
    <Label position={[(tier.start + tier.end) / 2, 0.1, -1.8]} height={0.65} maxWidth={5.3} color="#9cd5c2" text={t('最高折扣：{0}', [tier.cap])} />
    {tier.items.map(({ type, price, x, z }) => <group key={type} position={[x, 0, z]}>
      <Selectable hint={buildingHint(type)} target={{ kind: 'building', type }} size={[2.3, 1.8]}>
        <Model name={BUILDING_MODEL[type]} width={2.3} depth={1.8} height={2.2} muted={stock[type] === 0} />
        <Label position={[0, 0.1, 0.98]} height={0.68} maxWidth={2.45} text={BUILDING[type]} suffix={`×${stock[type]}`} />
        <Label position={[0, 0.1, 1.3]} height={0.55} maxWidth={2.45} text={`🪙 ${price}　 👤 ${BUILDINGS[type].workerSlots}`} />
      </Selectable>
    </group>)}
    {tier.start > 0 && <mesh position={[tier.start - 1.8, 0.035, (tier.depth - 4) / 2]} dispose={null} geometry={box(0.025, 0.02, 9)} material={material('#aa946b')} />}
  </group>)}</group>;
}
