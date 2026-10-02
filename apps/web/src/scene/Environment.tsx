import { useMemo, Suspense, lazy, Component } from 'react';
const IslandTrial = lazy(() => import('./IslandTrial.js').then(m => ({ default: m.IslandTrial })));
import type { ReactNode } from 'react';
import { useTexture } from '@react-three/drei';
import { MirroredRepeatWrapping, SRGBColorSpace } from 'three';
import { MAIN_ISLAND, PLAYER_ISLAND } from './archipelago.js';

/** Loader-cached textures are shared by all seats. Artwork is already lit; keep its painted palette. */
function IslandSurface({ player = false }: { player?: boolean }) {
  const texture = useTexture(`/art/environment/${player ? 'player-island' : 'main-island'}.webp`);
  useMemo(() => { texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8; }, [texture]);
  const size = player ? PLAYER_ISLAND : MAIN_ISLAND;
  return <mesh position={[0, player ? 0.08 : -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[size.width, size.depth]} />
    <meshBasicMaterial map={texture} transparent alphaTest={0.015} toneMapped={false} />
  </mesh>;
}
function OceanSurface() {
  const texture = useTexture('/art/environment/ocean.webp');
  useMemo(() => {
    texture.colorSpace = SRGBColorSpace;
    // Mirroring joins the supplied edges cleanly even if the source is not perfectly periodic.
    texture.wrapS = texture.wrapT = MirroredRepeatWrapping;
    texture.repeat.set(16, 16);
    texture.anisotropy = 8;
    texture.needsUpdate = true;
  }, [texture]);
  return <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[640, 640]} />
    <meshBasicMaterial map={texture} toneMapped={false} />
  </mesh>;
}
class IslandFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <IslandSurface /> : this.props.children; }
}
export function Island({ player = false }: { player?: boolean }) {
  if (!player && new URLSearchParams(location.search).get('island') === '3d') {
    return <Suspense fallback={<IslandSurface />}><IslandFallback><IslandTrial /></IslandFallback></Suspense>;
  }
  return <Suspense fallback={null}><IslandSurface player={player} /></Suspense>;
}
export function Ocean() {
  return <Suspense fallback={null}><OceanSurface /></Suspense>;
}
