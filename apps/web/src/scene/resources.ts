import { BoxGeometry, CylinderGeometry, MeshStandardMaterial } from 'three';
import type { BufferGeometry } from 'three';

/**
 * Shared GPU resources (PR-055). Pieces repeat hundreds of times on a full table; one geometry per shape
 * and one material per colour keeps uploads bounded. They live for the page, so meshes using them set
 * `dispose={null}` and R3F never frees them; their count is fixed by the palette and piece sizes.
 */
const geometries = new Map<string, BufferGeometry>();
const materials = new Map<string, MeshStandardMaterial>();
export function box(w: number, h: number, d: number) {
  const key = `box:${w}:${h}:${d}`;
  return geometries.get(key) ?? geometries.set(key, new BoxGeometry(w, h, d)).get(key)!;
}
export function cylinder(r: number, h: number, segments = 12) {
  const key = `cyl:${r}:${h}:${segments}`;
  return geometries.get(key) ?? geometries.set(key, new CylinderGeometry(r, r, h, segments)).get(key)!;
}
export function material(color: string) {
  return materials.get(color) ?? materials.set(color, new MeshStandardMaterial({ color })).get(color)!;
}
export const sharedCounts = () => ({ geometries: geometries.size, materials: materials.size });

/** Live label textures; each Label creates one on mount and disposes it on unmount. */
export const liveTextures = { count: 0 };
