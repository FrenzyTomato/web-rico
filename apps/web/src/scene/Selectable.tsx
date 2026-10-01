import { useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { Interaction, targetKey, useSelectable } from './Selection.js';
import type { SceneTarget } from './Selection.js';

// Scene-side selection (three.js/R3F): kept apart from Selection.tsx so the lazy scene chunk holds all 3D code.
/** Development/test registry of selectable objects, so browser tests can click real canvas positions. */
const registry = new Map<string, { target: SceneTarget; group: Group }>();

/** Wraps a scene object: click selects it; actionable objects get a gold outline and a pointer cursor. */
export function Selectable({ target, size, children }: { target: SceneTarget; size: [number, number]; children: ReactNode }) {
  const { active, handlers } = useSelectable(target);
  const ref = useRef<Group>(null);
  const key = targetKey(target);
  const pulsing = useContext(Interaction).pulse === key;
  useEffect(() => {
    if (!import.meta.env.DEV || !ref.current) return;
    registry.set(key, { target, group: ref.current });
    return () => { registry.delete(key); };
  }, [key, target]);
  return (
    <group ref={ref} {...handlers}>
      {pulsing && <Pulse size={size} />}
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

/** A short growing gold ring; requests frames only while mounted, so on-demand rendering stays cheap. */
function Pulse({ size }: { size: [number, number] }) {
  const ref = useRef<Mesh>(null);
  useFrame(({ clock, invalidate }) => {
    const t = (clock.getElapsedTime() * 2) % 1;
    ref.current?.scale.set(1 + t * 0.4, 1, 1 + t * 0.4);
    invalidate();
  });
  return (
    <mesh ref={ref} position={[0, 0.03, 0]}>
      <boxGeometry args={[size[0] + 0.6, 0.06, size[1] + 0.6]} />
      <meshBasicMaterial color="#f2d27a" transparent opacity={0.7} />
    </mesh>
  );
}
