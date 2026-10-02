import { useEffect, useMemo } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh } from 'three';
import { fitIslandTrial } from './islandTrialModel.js';
/** Cached Meshy terrain fitted to the board; the original asset is never modified. */
export function IslandTrial() {
  const { scene } = useGLTF('/art/meshy-island/Main%20Island.glb');
  const model = useMemo(() => {
    const { root } = fitIslandTrial(scene, 0.35, true);
    // Game hit targets belong to the pieces, not the decorative terrain.
    root.traverse(object => { object.raycast = () => {}; });
    return root;
  }, [scene]);
  useEffect(() => () => { model.traverse(object => { if (object instanceof Mesh) object.geometry.dispose(); }); }, [model]);
  return <primitive object={model} dispose={null} />;
}
