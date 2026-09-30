import { PerspectiveCamera } from '@react-three/drei';

/** Semi-top-down view from the viewer's side of the table, looking at its centre. */
export function Camera() {
  return <PerspectiveCamera makeDefault position={[0, 11, 9]} fov={45} onUpdate={c => c.lookAt(0, 0, 0)} />;
}
