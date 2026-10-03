import { useTouchHint } from './useTouchHint.js';
import { useContext, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Vector3 } from 'three';
import type { Group, Mesh } from 'three';
import { HoverHint } from './ModelHint.js';
import type { PieceHint } from './effects.js';
import { Interaction, targetKey, useSelectable } from './Selection.js';
import type { SceneTarget } from './Selection.js';
import { OutlineColor } from './ModelOutline.js';

// Scene-side selection (three.js/R3F): kept apart from Selection.tsx so the lazy scene chunk holds all 3D code.
/** Development/test registry of selectable objects, so browser tests can click real canvas positions. */
const registry = new Map<string, { target: SceneTarget; group: Group }>();

/** Wraps a scene object: click selects it; actionable objects get a gold outline and a pointer cursor. */
export function Selectable({ target, size, children, hint, outline = false, circular = false, hitHeight = 0.6 }: { target: SceneTarget; size: [number, number]; children?: ReactNode; hint?: PieceHint; outline?: boolean; circular?: boolean; hitHeight?: number }) {
  const showHint = useContext(HoverHint);
  const touch = useTouchHint(() => { if (hint) showHint(hint); });
  const { active, handlers } = useSelectable(target);
  const ref = useRef<Group>(null);
  const key = targetKey(target);
  const interaction = useContext(Interaction);
  const pulsing = interaction.pulse === key;
  const selected = interaction.selectedKey === key;
  const buildingBase = target.kind === 'building' || target.kind === 'owned-building';
  const modelStroke = ['estate', 'quarry', 'tile', 'worker'].includes(target.kind);
  useEffect(() => {
    if (!import.meta.env.DEV || !ref.current) return;
    registry.set(key, { target, group: ref.current });
    return () => { registry.delete(key); };
  }, [key, target]);
  return (
    <group ref={ref} {...handlers}
      onClick={e => { if (touch.suppressClick()) { e.stopPropagation(); return; } handlers.onClick(e); }}
      onPointerOver={e => { if (!touch.isTouch(e)) { handlers.onPointerOver(); if (hint) showHint(hint); } }}
      onPointerMove={e => { if (!touch.isTouch(e) && hint) showHint(hint); }}
      onPointerDown={e => { if (touch.isTouch(e)) { e.stopPropagation(); touch.down(e); } else if (hint) showHint(hint); }}
      onPointerOut={e => { if (touch.isTouch(e)) touch.cancel(); else { handlers.onPointerOut(); if (hint) showHint(null); } }}>
      {pulsing && <Pulse size={size} />}
      {(active || selected) && !modelStroke && (
        buildingBase ? <group>
          {/* A slightly expanded footprint keeps the border outside the model's plinth. */}
          {[-1, 1].flatMap(side => [
            <mesh key={`base-x${side}`} position={[side * (size[0] / 2 + 0.06), 0.08, 0]}>
              <boxGeometry args={[0.06, 0.04, size[1] + 0.18]} /><meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} toneMapped={false} />
            </mesh>,
            <mesh key={`base-z${side}`} position={[0, 0.08, side * (size[1] / 2 + 0.06)]}>
              <boxGeometry args={[size[0] + 0.18, 0.04, 0.06]} /><meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} toneMapped={false} />
            </mesh>,
          ])}
        </group> : circular ? <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.17, 0.185, 32]} /><meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} />
        </mesh> : outline ? <group>
          {[-1, 1].flatMap(side => [
            <mesh key={`x${side}`} position={[side * size[0] / 2, 0.015, 0]}>
              <boxGeometry args={[0.025, 0.02, size[1]]} /><meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} />
            </mesh>,
            <mesh key={`z${side}`} position={[0, 0.015, side * size[1] / 2]}>
              <boxGeometry args={[size[0], 0.02, 0.025]} /><meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} />
            </mesh>,
          ])}
        </group> : <mesh position={[0, 0.035, 0]}>
          <boxGeometry args={[size[0] * 1.1, 0.025, size[1] * 1.1]} />
          <meshBasicMaterial color={selected ? '#d5fff0' : '#87dcca'} />
        </mesh>
      )}
      {/* Stable low-cost hit box also works while art is loading or unavailable. */}
      <mesh position={[0, hitHeight / 2, 0]}>
        <boxGeometry args={[size[0], hitHeight, size[1]]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
      <OutlineColor.Provider value={modelStroke && (active || selected) ? selected ? '#d5fff0' : '#87dcca' : null}>{children}</OutlineColor.Provider>
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
