import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { CanvasTexture } from 'three';
import type { PlayerView } from '@vibe-rico/protocol';
import { Camera } from './Camera.js';

export const TABLE = { width: 14, depth: 9 } as const;

/**
 * Seat positions around an oval table, clockwise in seat order (seen from above), with the viewer's seat
 * at the front edge nearest the camera. Pure, so layouts for 3/4/5 players are testable without WebGL.
 */
export function seatPositions(seatOrder: readonly string[], viewerId: string) {
  const n = seatOrder.length, viewer = seatOrder.indexOf(viewerId);
  return seatOrder.map((playerId, i) => {
    // Angle 0 is the front (+z); clockwise from above runs toward -x.
    const angle = (2 * Math.PI * (((i - viewer) % n) + n)) / n;
    return { playerId, x: -Math.sin(angle) * (TABLE.width / 2 - 1.5), z: Math.cos(angle) * (TABLE.depth / 2 - 1) };
  });
}

/**
 * A name drawn onto a canvas texture and shown as a sprite: no extra React roots (drei Html remounted
 * endlessly under React 19) and no font download. Names are also listed in the DOM client.
 */
function Label({ text, position }: { text: string; position: [number, number, number] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 128;
    const g = canvas.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 128);
    g.fillStyle = '#111111'; g.font = 'bold 72px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 256, 64);
    return new CanvasTexture(canvas);
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[4, 1, 1]}><spriteMaterial map={texture} /></sprite>;
}

/** The table, lighting and one labelled seat marker per player. Reads only PlayerView. */
export function TableScene({ view, names }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  return (
    <div style={{ height: 360 }} aria-label="桌面">
      <Canvas>
        <Camera />
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 10, 5]} intensity={0.9} />
        <mesh position={[0, -0.25, 0]}>
          <boxGeometry args={[TABLE.width, 0.5, TABLE.depth]} />
          <meshStandardMaterial color="#7a5230" />
        </mesh>
        {seatPositions(view.seatOrder, view.viewer.playerId).map(seat => (
          <group key={seat.playerId} position={[seat.x, 0, seat.z]}>
            <mesh position={[0, 0.1, 0]}>
              <boxGeometry args={[3, 0.2, 2]} />
              <meshStandardMaterial color={seat.playerId === view.viewer.playerId ? '#2f6f4f' : '#4b5d6b'} />
            </mesh>
            <Label position={[0, 0.9, 0]}
              text={`${names[seat.playerId] ?? seat.playerId}${seat.playerId === view.governorPlayerId ? '（总督）' : ''}`} />
          </group>
        ))}
      </Canvas>
    </div>
  );
}
