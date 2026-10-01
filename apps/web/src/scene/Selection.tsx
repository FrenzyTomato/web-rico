import { createContext, useContext } from 'react';
import type { Good } from '@vibe-rico/game-engine';
import type { Option } from '../actions/options.js';

/** Things on the table a player can point at. Keys are stable across updates. */
export type SceneTarget =
  | { kind: 'role'; id: string } | { kind: 'estate'; id: string } | { kind: 'quarry' }
  | { kind: 'building'; type: string } | { kind: 'ship'; id: string } | { kind: 'good'; good: Good } | { kind: 'tile'; id: string };
export const targetKey = (t: SceneTarget) =>
  t.kind === 'quarry' ? 'quarry' : `${t.kind}:${'id' in t ? t.id : 'type' in t ? t.type : t.good}`;

/**
 * The legal options that act on `target`, filtered from the engine's descriptors (never computed here):
 * an object with none offers no executable action.
 */
export function optionsForTarget(options: readonly Option[], target: SceneTarget): Option[] {
  return options.filter(({ action: a }) => {
    switch (target.kind) {
      case 'role': return a.kind === 'choose-role' && a.roleCardId === target.id;
      case 'estate': return a.kind === 'plant' && a.choice.kind === 'estate' && a.choice.tileId === target.id;
      case 'quarry': return a.kind === 'plant' && a.choice.kind === 'quarry';
      case 'building': return a.kind === 'build' && a.purchase?.buildingTypeId === target.type;
      case 'ship': return a.kind === 'load' && a.shipment.kind === 'cargo' && a.shipment.shipId === target.id;
      case 'tile': return a.kind === 'use-hospital' && a.tileId === target.id;
      case 'good': return (a.kind === 'trade' && a.sale?.good === target.good) || (a.kind === 'take-production-bonus' && a.good === target.good)
        || (a.kind === 'load' && a.shipment.kind === 'personal' && a.shipment.good === target.good);
    }
  });
}

/** `pulse` is the target key the event animation is highlighting (PR-053), if any. */
export interface SceneInteraction { actionable(target: SceneTarget): boolean; select(target: SceneTarget): void; pulse: string | null }
export const Interaction = createContext<SceneInteraction>({ actionable: () => false, select: () => {}, pulse: null });
export const SceneInteractionProvider = Interaction.Provider;

/** Props for a selectable mesh: gold highlight when actionable, pointer cursor, click selects. */
export function useSelectable(target: SceneTarget) {
  const { actionable, select } = useContext(Interaction);
  const active = actionable(target);
  return {
    active,
    handlers: {
      onClick: (e: { stopPropagation(): void }) => { e.stopPropagation(); select(target); },
      onPointerOver: () => { document.body.style.cursor = active ? 'pointer' : 'default'; },
      onPointerOut: () => { document.body.style.cursor = 'default'; },
    },
    emissive: active ? '#c9a45c' : '#000000',
  };
}
