import { createContext, useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group } from 'three';
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

export interface SceneInteraction { actionable(target: SceneTarget): boolean; select(target: SceneTarget): void }
const Interaction = createContext<SceneInteraction>({ actionable: () => false, select: () => {} });
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


/** Development/test registry of selectable objects, so browser tests can click real canvas positions. */
const registry = new Map<string, { target: SceneTarget; group: Group }>();

/** Wraps a scene object: click selects it; actionable objects get a gold outline and a pointer cursor. */
export function Selectable({ target, size, children }: { target: SceneTarget; size: [number, number]; children: ReactNode }) {
  const { active, handlers } = useSelectable(target);
  const ref = useRef<Group>(null);
  const key = targetKey(target);
  useEffect(() => {
    if (!import.meta.env.DEV || !ref.current) return;
    registry.set(key, { target, group: ref.current });
    return () => { registry.delete(key); };
  }, [key, target]);
  return (
    <group ref={ref} {...handlers}>
      {active && (
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[size[0] + 0.3, 0.04, size[1] + 0.3]} />
          <meshBasicMaterial color="#c9a45c" />
        </mesh>
      )}
      {children}
    </group>
  );
}

/** DEV only: `window.__sceneTargets()` lists actionable objects with their canvas-relative pixel positions. */
export function TargetProbe() {
  const { camera, size } = useThree();
  const { actionable } = useContext(Interaction);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __sceneTargets: () => unknown }).__sceneTargets = () => [...registry.entries()].map(([key, { target, group }]) => {
      const p = group.getWorldPosition(new Vector3()).project(camera);
      return { key, actionable: actionable(target), x: ((p.x + 1) / 2) * size.width, y: ((1 - p.y) / 2) * size.height };
    });
  }, [camera, size, actionable]);
  return null;
}
