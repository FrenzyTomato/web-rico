import { PLAYER_ISLAND, PRIVATE_BOAT_Z } from './archipelago.js';
import { t, useLanguage } from '../i18n/language.js';
import type { PublicPlayerView } from '@vibe-rico/protocol';
import { Buildings } from './Buildings.js';
import { Fields } from './Fields.js';
import { Label } from './Label.js';
import { Mat, ESTATE_X, CITY_X, GRID_Z, CITY_Z } from './Mat.js';
export { BOARD } from './Mat.js';
import { Model } from './Model.js';
import { Selectable } from './Selectable.js';
import { IslandStats } from './IslandStats.js';
import { GOODS } from '../actions/options.js';
import { GOOD } from '../i18n/terms.js';

/** Estates and buildings, plus a stats line (coins, goods, idle workers) in the open ground at the top. */
export function PlayerBoard({ player, color, title, role, mine = false }: {
  player: PublicPlayerView; color: string; title: string; role?: string | undefined; mine?: boolean;
}) {
  useLanguage();
  const held = GOODS.filter(good => player.goods[good] > 0);
  return <group>
    <Mat color={color} />
    <group position={[ESTATE_X, 0.15, GRID_Z]}><Fields countryside={player.countryside} mine={mine} /></group>
    <group position={[CITY_X, 0.15, CITY_Z]}><Buildings buildings={player.buildings} mine={mine} /></group>
    <Label position={[0, 0.3, -PLAYER_ISLAND.depth / 2 - 1.1]} height={0.95} maxWidth={PLAYER_ISLAND.width - 1} text={title} />
    <IslandStats position={[0.9, 0.2, -5.1]} maxWidth={9}
      summary={`${player.coins}${t(" 金币 · ")}${held.reduce((a, g) => a + player.goods[g], 0)}${t(" 货物")}${role ? ` · ${role}` : ''}`}
      goods={held.map(good => ({ good, label: `${GOOD[good]} ×${player.goods[good]}` }))} workers={`${t("工人池 ")}${player.idleWorkerCount}`} />
    {player.personalShip && <group position={[0, 0.15, PRIVATE_BOAT_Z]}>
      {mine ? <Selectable target={{ kind: 'personal-ship' }} size={[2, 1]}><Model name="Private Boat" width={2} depth={1} height={0.9} /></Selectable>
        : <Model name="Private Boat" width={2} depth={1} height={0.9} />}
      <Label position={[0, 0.1, 0.85]} height={0.44} ink="#2a2118" text={t("私人船")} />
    </group>}
  </group>;
}
