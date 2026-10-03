import { BUILDING_MARKET_ORIGIN, compactBuildingTiers } from './pieces.js';
import { HOME_Z } from './archipelago.js';
import { useEffect, useRef } from 'react';
import type { ComponentRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { MOUSE, TOUCH, Vector3 } from 'three';

export type BoardView = 'shared' | 'buildings' | 'boats' | 'depot' | 'estates' | 'mine' | 'overview' | `buildings-${1 | 2 | 3 | 4}`;
export type CameraCommand = { id: number; view: BoardView; island?: { x: number; z: number } } | { id: number; zoom: number };
const WIDE_ASPECT = 1.6;
export const cameraDistanceScale = (aspect: number) => Math.min(2, Math.max(1, WIDE_ASPECT / aspect));

/** Fit the requested area, leaving room for raised pieces and labels. */
export function boardFrame(view: BoardView, aspect: number, mobile = false) {
  const frames = {
    shared: { width: 58, depth: 29, x: 0, z: 0 },
    buildings: { width: 26, depth: 15, x: BUILDING_MARKET_ORIGIN.x + 11, z: BUILDING_MARKET_ORIGIN.z + 3.5 },
    boats: { width: 20, depth: 12, x: 0.6, z: -6.5 },
    depot: { width: 10, depth: 12, x: 18, z: -8 },
    estates: { width: 11, depth: 13, x: -17.5, z: 4.5 },
    mine: { width: 16, depth: 20, x: 0, z: HOME_Z + 0.5 },
    overview: { width: 104, depth: 78, x: 0, z: 1 },
  };
  const tier = view.startsWith('buildings-') ? compactBuildingTiers().find(t => t.cap === Number(view.slice(-1))) : undefined;
  const frame = tier ? { width: tier.end - tier.start + 3.4, depth: tier.depth + 2, x: BUILDING_MARKET_ORIGIN.x + (tier.start + tier.end) / 2, z: BUILDING_MARKET_ORIGIN.z + (tier.depth - 4) / 2 } : frames[view as keyof typeof frames];
  const closeUp = mobile && view !== 'overview' ? tier ? 1 : 0.75 : 1;
  // Portrait harbour framing includes the docks and market, rather than mostly open sea.
  return { x: frame.x, z: view === 'boats' && aspect < 0.85 ? 0 : frame.z, distance: Math.max(frame.width / Math.max(aspect, 0.3), frame.depth) / (2 * Math.tan(Math.PI / 8)) * 1.1 * closeUp };
}

/** Left-drag pans, right-drag rotates, wheel zooms toward the pointer; pinch zooms. Keep the camera above the islands. */
export function Camera({ command, touchRotate = false }: { command: CameraCommand; touchRotate?: boolean }) {
  const { camera, size, invalidate } = useThree();
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const lastCommand = useRef(-1);
  const currentView = useRef<BoardView>('shared');
  const island = useRef<{ x: number; z: number } | undefined>(undefined);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    const isNew = lastCommand.current !== command.id;
    if (isNew && 'zoom' in command) {
      const offset = camera.position.clone().sub(orbit.target);
      offset.setLength(Math.min(300, Math.max(4, offset.length() * command.zoom)));
      camera.position.copy(orbit.target).add(offset);
    } else {
      if ('view' in command) { currentView.current = command.view; island.current = command.island; }
      const frame = boardFrame(currentView.current, size.width / Math.max(1, size.height), size.width <= 700);
      orbit.target.set(island.current?.x ?? frame.x, 0.4, island.current ? island.current.z + 0.5 : frame.z);
      camera.position.copy(orbit.target).add(new Vector3(0, 0.9, 0.436).normalize().multiplyScalar(frame.distance));
    }
    lastCommand.current = command.id;
    camera.lookAt(orbit.target);
    orbit.update();
    invalidate();
  }, [camera, command, size.width, size.height, invalidate]);
  return <OrbitControls ref={controls} makeDefault enableRotate zoomToCursor screenSpacePanning={false} enableDamping={false}
    minPolarAngle={0.15} maxPolarAngle={Math.PI / 3} rotateSpeed={0.5}
    minDistance={4} maxDistance={300} zoomSpeed={size.width <= 700 ? 1 : 0.12} panSpeed={0.8}
    mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
    touches={{ ONE: touchRotate && size.width <= 700 ? TOUCH.ROTATE : TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }} />;
}
