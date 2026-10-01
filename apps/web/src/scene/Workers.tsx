import { cylinder, material } from './resources.js';

/** Worker discs: `count` filled, the rest of `capacity` shown as empty rings. */
export function Workers({ count, capacity, y = 0.25 }: { count: number; capacity: number; y?: number }) {
  const start = -((capacity - 1) * 0.28) / 2;
  return <>{Array.from({ length: capacity }, (_, i) => (
    <mesh key={i} position={[start + i * 0.28, y, 0]} dispose={null}
      geometry={cylinder(0.11, i < count ? 0.12 : 0.03)} material={material(i < count ? '#3a2a1e' : '#cbbd9c')} />
  ))}</>;
}
