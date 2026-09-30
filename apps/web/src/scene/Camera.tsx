import { PerspectiveCamera } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

/** At aspect ≥ WIDE_ASPECT the base position frames the whole table; narrower stages move the camera back. */
const WIDE_ASPECT = 1.6;
export const cameraDistanceScale = (aspect: number) => Math.min(2, Math.max(1, WIDE_ASPECT / aspect));

/** Semi-top-down view from the viewer's side of the table, looking at its centre, fitted to the stage width. */
export function Camera() {
  const { width, height } = useThree(s => s.size);
  const k = cameraDistanceScale(width / Math.max(height, 1));
  return <PerspectiveCamera makeDefault position={[0, 25 * k, 18 * k]} fov={45} onUpdate={c => c.lookAt(0, 0, 0)} />;
}
