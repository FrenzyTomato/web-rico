import { createContext, useContext } from 'react';
import type { Good } from '@vibe-rico/game-engine';
import type { Option } from '../actions/options.js';

/** Things on the table a player can point at. Keys are stable across updates. */
export type SceneTarget =
  | { kind: 'ship-slot'; id: string; index: number } | { kind: 'depot-slot'; index: number }
  | { kind: 'worker'; id: string; index: number } | { kind: 'owned-building'; id: string }
  | { kind: 'crate'; good: Good; index: number } | { kind: 'depot' } | { kind: 'personal-ship' }
  | { kind: 'role'; id: string } | { kind: 'estate'; id: string } | { kind: 'quarry' }
  | { kind: 'building'; type: string } | { kind: 'ship'; id: string } | { kind: 'good'; good: Good } | { kind: 'tile'; id: string };
export const targetKey = (t: SceneTarget): string => {
  if (t.kind === 'ship-slot') return `ship-slot:${t.id}:${t.index}`;
  if (t.kind === 'depot-slot') return `depot-slot:${t.index}`;
  if (t.kind === 'worker') return `worker:${t.id}:${t.index}`;
  if (t.kind === 'crate') return `crate:${t.good}:${t.index}`;
  return 'id' in t ? `${t.kind}:${t.id}` : 'type' in t ? `${t.kind}:${t.type}` : 'good' in t ? `${t.kind}:${t.good}` : t.kind;
};

/**
 * The legal options that act on `target`, filtered from the engine's descriptors (never computed here):
 * an object with none offers no executable action.
 */
export function optionsForTarget(options: readonly Option[], target: SceneTarget): Option[] {
  return options.filter(({ action: a }) => {
    switch (target.kind) {
      case 'worker': case 'owned-building': return false;
      case 'depot-slot': case 'depot': return a.kind === 'trade' && a.sale !== null;
      case 'personal-ship': return a.kind === 'load' && a.shipment.kind === 'personal';
      case 'crate': return (a.kind === 'trade' && a.sale?.good === target.good) || (a.kind === 'load' && a.shipment.good === target.good);
      case 'role': return a.kind === 'choose-role' && a.roleCardId === target.id;
      case 'estate': return a.kind === 'plant' && a.choice.kind === 'estate' && a.choice.tileId === target.id;
      case 'quarry': return a.kind === 'plant' && a.choice.kind === 'quarry';
      case 'building': return a.kind === 'build' && a.purchase?.buildingTypeId === target.type;
      case 'ship-slot': case 'ship': return a.kind === 'load' && a.shipment.kind === 'cargo' && a.shipment.shipId === target.id;
      case 'tile': return a.kind === 'use-hospital' && a.tileId === target.id;
      case 'good': return (a.kind === 'trade' && a.sale?.good === target.good) || (a.kind === 'take-production-bonus' && a.good === target.good)
        || (a.kind === 'load' && a.shipment.kind === 'personal' && a.shipment.good === target.good);
    }
  });
}

/** `pulse` is the target key the event animation is highlighting (PR-053), if any. */
export interface SceneInteraction { actionable(target: SceneTarget): boolean; select(target: SceneTarget): void; pulse: string | null; selectedKey?: string | null; inspect?: (target: SceneTarget | null) => boolean }
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
