import type { PublicPlayerView } from '@vibe-rico/protocol';
import { GOOD } from '../i18n/terms.js';
import { Buildings } from './Buildings.js';
import { CELL, Fields } from './Fields.js';
import { Label } from './Label.js';
import { GRID } from './boardLayout.js';
import { GOOD_COLOR } from './pieces.js';
import { Selectable } from './Selectable.js';

export const BOARD = { width: GRID.cols * CELL * 2 + 1.2, depth: GRID.rows * CELL + 1.6 } as const;

/**
 * One seat's public board (VISIBILITY-001): Countryside and City grids, workers, goods, coins and any
 * Personal Ship. Earned VP is never drawn here.
 */
export function PlayerBoard({ player, color, title, mine = false }: { player: PublicPlayerView; color: string; title: string; mine?: boolean }) {
  const goods = (Object.entries(player.goods) as [keyof typeof GOOD, number][]).filter(([, n]) => n > 0);
  const gridStart = -BOARD.width / 2 + 0.6 + CELL / 2;
  return (
    <group>
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[BOARD.width, 0.1, BOARD.depth]} /><meshStandardMaterial color="#efe4cc" /></mesh>
      <mesh position={[0, 0.06, -BOARD.depth / 2 + 0.2]}><boxGeometry args={[BOARD.width, 0.12, 0.4]} /><meshStandardMaterial color={color} /></mesh>
      <group position={[gridStart, 0.1, -BOARD.depth / 2 + 0.9]}><Fields countryside={player.countryside} mine={mine} /></group>
      <group position={[gridStart + GRID.cols * CELL + 0.4, 0.1, -BOARD.depth / 2 + 0.9]}><Buildings buildings={player.buildings} /></group>
      <group position={[-BOARD.width / 2 + 0.6, 0.1, BOARD.depth / 2 - 0.35]}>
        {goods.map(([good, count], i) => (
          <group key={good} position={[i * 0.9, 0, 0]}>
            {(() => {
              const barrel = <>
                <mesh position={[0, 0.2, 0]}><cylinderGeometry args={[0.18, 0.18, 0.35, 10]} /><meshStandardMaterial color={GOOD_COLOR[good]} /></mesh>
                <Label position={[0.35, 0.5, 0]} height={0.26} text={`${count}`} />
              </>;
              // The viewer's own goods are targets for selling, the production bonus and Personal Ship loads.
              return mine ? <Selectable target={{ kind: 'good', good }} size={[0.5, 0.5]}>{barrel}</Selectable> : barrel;
            })()}
          </group>
        ))}
      </group>
      <Label position={[0, 1.4, -BOARD.depth / 2]} height={0.7} text={title} />
      <Label position={[BOARD.width / 2 - 1.8, 0.5, BOARD.depth / 2 - 0.35]} height={0.3}
        text={`${player.coins} 金币 · 空闲 ${player.idleWorkerCount}${player.personalShip ? ` · 私人船 ${player.personalShip.goodType ? GOOD[player.personalShip.goodType] : '空'}${player.personalShip.loadedCount}` : ''}`} />
    </group>
  );
}
