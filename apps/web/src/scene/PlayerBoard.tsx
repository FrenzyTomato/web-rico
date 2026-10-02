import { PRIVATE_BOAT_Z } from './archipelago.js';
import { t, useLanguage } from '../i18n/language.js';
import type { PublicPlayerView } from '@vibe-rico/protocol';
import { Buildings } from './Buildings.js';
import { Fields } from './Fields.js';
import { Label } from './Label.js';
import { Mat, BOARD, ESTATE_X, CITY_X, GRID_Z, CITY_Z } from './Mat.js';
export { BOARD } from './Mat.js';
import { Model } from './Model.js';
import { Selectable } from './Selectable.js';

/** Estates and buildings only; personal resources live in the dock / player drawer. */
export function PlayerBoard({ player, color, title, mine = false }: {
  player: PublicPlayerView; color: string; title: string; mine?: boolean;
}) {
  useLanguage();
  return <group>
    <Mat color={color} />
    <group position={[ESTATE_X, 0.15, GRID_Z]}><Fields countryside={player.countryside} mine={mine} /></group>
    <group position={[CITY_X, 0.15, CITY_Z]}><Buildings buildings={player.buildings} mine={mine} /></group>
    <Label position={[0, 0.3, -BOARD.depth / 2 + 0.4]} height={0.48} text={title} />
    {player.personalShip && <group position={[0, 0.15, PRIVATE_BOAT_Z]}>
      {mine ? <Selectable target={{ kind: 'personal-ship' }} size={[2, 1]}><Model name="Private Boat" width={2} depth={1} height={0.9} /></Selectable>
        : <Model name="Private Boat" width={2} depth={1} height={0.9} />}
      <Label position={[0, 0.1, 0.85]} height={0.44} ink="#2a2118" text={t("私人船")} />
    </group>}
  </group>;
}
