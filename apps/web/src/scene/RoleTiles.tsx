import { t, useLanguage } from '../i18n/language.js';
import type { RoleCard } from '@vibe-rico/game-engine';
import { ROLE } from '../i18n/terms.js';
import { Label } from './Label.js';
import { Selectable } from './Selectable.js';
import { Model } from './Model.js';
import { ROLE_MODEL } from './modelCatalog.js';
import { cylinder } from './resources.js';

/** Role cards in a row: coins stacked on each card; a chosen card is darkened and names its chooser. */
export function RoleTiles({ cards, names }: { cards: readonly RoleCard[]; names: Readonly<Record<string, string>> }) {
  useLanguage();
  const start = -((cards.length - 1) * 2.2) / 2;
  return (
    <group>
      {cards.map((card, i) => (
        <group key={card.instanceId} position={[start + i * 2.2, 0, 0]}>
          <Selectable target={{ kind: 'role', id: card.instanceId }} size={[1.9, 2]}>
          <Model name={ROLE_MODEL[card.kind]} width={1.9} depth={2} height={0.15} muted={!!card.selectedBy} />
          {Array.from({ length: card.accumulatedCoins }, (_, c) => (
            <mesh key={c} position={[0, 0.15 + c * 0.08, 0.4]} dispose={null} geometry={cylinder(0.25, 0.06, 16)}>
              <meshStandardMaterial color="#c9a45c" metalness={0.4} />
            </mesh>
          ))}
          <Label position={[0, 0.2, -1]} height={0.44} text={ROLE[card.kind]} />
          {card.selectedBy && <Label position={[0, 0.9, 0.5]} height={0.62} ink="#efe4cc" text={names[card.selectedBy] ?? card.selectedBy} />}
          {card.accumulatedCoins > 0 && <Label position={[0, 0.5, 1.2]} height={0.55} text={t("{0} 金币", [card.accumulatedCoins])} />}
          </Selectable>
        </group>
      ))}
    </group>
  );
}
