import type { RoleCard } from '@vibe-rico/game-engine';
import { ROLE } from '../i18n/terms.js';
import { Label } from './Label.js';

/** Role cards in a row: coins stacked on each card; a chosen card is darkened and names its chooser. */
export function RoleTiles({ cards, names }: { cards: readonly RoleCard[]; names: Readonly<Record<string, string>> }) {
  const start = -((cards.length - 1) * 2.2) / 2;
  return (
    <group>
      {cards.map((card, i) => (
        <group key={card.instanceId} position={[start + i * 2.2, 0, 0]}>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[1.9, 0.1, 2]} />
            <meshStandardMaterial color={card.selectedBy ? '#6d5a44' : '#efe4cc'} />
          </mesh>
          {Array.from({ length: card.accumulatedCoins }, (_, c) => (
            <mesh key={c} position={[0, 0.15 + c * 0.08, 0.4]}>
              <cylinderGeometry args={[0.25, 0.25, 0.06, 16]} />
              <meshStandardMaterial color="#c9a45c" metalness={0.4} />
            </mesh>
          ))}
          <Label position={[0, 0.9, -0.4]} height={0.6} text={ROLE[card.kind]} />
          {card.selectedBy && <Label position={[0, 0.9, 0.5]} height={0.5} ink="#efe4cc" paper="#4a3222" text={names[card.selectedBy] ?? card.selectedBy} />}
          {card.accumulatedCoins > 0 && <Label position={[0, 0.5, 1.2]} height={0.45} text={`${card.accumulatedCoins} 金币`} />}
        </group>
      ))}
    </group>
  );
}
