import { Canvas } from '@react-three/fiber';
import type { PlayerView } from '@vibe-rico/protocol';
import { Camera } from './Camera.js';
import { CommonBoard } from './CommonBoard.js';
import { PlayerBoard } from './PlayerBoard.js';
import { SEAT_COLORS } from './pieces.js';

export const TABLE = { width: 36, depth: 24 } as const;

/**
 * Seat positions around an oval, clockwise in seat order (seen from above), with the viewer's seat at the
 * front edge nearest the camera. Pure, so layouts for 3/4/5 players are testable without WebGL.
 */
export function seatPositions(seatOrder: readonly string[], viewerId: string) {
  const n = seatOrder.length, viewer = seatOrder.indexOf(viewerId);
  return seatOrder.map((playerId, i) => {
    // Angle 0 is the front (+z); clockwise from above runs toward -x.
    const angle = (2 * Math.PI * (((i - viewer) % n) + n)) / n;
    return { playerId, x: -Math.sin(angle) * (TABLE.width / 2 - 4), z: Math.cos(angle) * (TABLE.depth / 2 - 2.2) };
  });
}

/** A wood-framed island in a teal sea (DESIGN.md): the shared harbour in the centre, one seat per player. */
export function TableScene({ view, names }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  return (
    <div className="scene" aria-label="桌面">
      {/* Redraw only when props change: a board game is static between states (continuous 60 fps starved e2e tabs). */}
      <Canvas frameloop="demand">
        <color attach="background" args={['#2f7f86']} />
        <Camera />
        <ambientLight intensity={0.7} />
        <directionalLight position={[8, 20, 10]} intensity={1.1} color="#fff1d6" />
        <mesh position={[0, -0.8, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[120, 120]} />
          <meshStandardMaterial color="#2f7f86" />
        </mesh>
        <mesh position={[0, -0.45, 0]}>
          <boxGeometry args={[TABLE.width + 1, 0.7, TABLE.depth + 1]} />
          <meshStandardMaterial color="#2b1d14" />
        </mesh>
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[TABLE.width, 0.1, TABLE.depth]} />
          <meshStandardMaterial color="#d9c8a2" />
        </mesh>
        <CommonBoard view={view} names={names} />
        {seatPositions(view.seatOrder, view.viewer.playerId).map((seat, i) => (
          <group key={seat.playerId} position={[seat.x, 0, seat.z]}>
            <PlayerBoard player={view.players[i]!} color={SEAT_COLORS[i]!}
              title={`${names[seat.playerId] ?? seat.playerId}${seat.playerId === view.governorPlayerId ? '（总督）' : ''}${seat.playerId === view.viewer.playerId ? '（你）' : ''}`} />
          </group>
        ))}
      </Canvas>
    </div>
  );
}
