/** Bay centres measured from the runtime meshes, after Model's uniform fit and
 * before boat rotation. Keep these anchors with the asset dimensions: generated
 * boats have different bow bays, and the depot's roof occupies its rear half. */
export interface CargoBays { centres: [number, number, number][]; size: number }
export const BOAT_FIT = { width: 6.2, depth: 3.6, height: 2.2 };
export const DEPOT_FIT = { width: 4, depth: 5, height: 2.2 };
export const BOAT_BAYS: Record<number, CargoBays> = {
  4: { size: 0.62, centres: [[-0.43, 1.373, -0.43], [0.46, 1.349, -0.43], [-0.43, 1.373, 0.43], [0.46, 1.349, 0.43]] },
  5: { size: 0.56, centres: [[-1.12, 1.6, 0], [-0.25, 1.585, -0.38], [0.6, 1.586, -0.38], [-0.25, 1.586, 0.38], [0.6, 1.584, 0.38]] },
  6: { size: 0.5, centres: [[-0.83, 1.646, -0.38], [-0.83, 1.646, 0.38], [-0.02, 1.645, -0.38], [-0.02, 1.645, 0.38], [0.78, 1.645, -0.38], [0.78, 1.646, 0.38]] },
  7: { size: 0.4, centres: [[-1.22, 1.637, 0], [-0.6, 1.593, -0.3], [-0.6, 1.593, 0.32], [0.05, 1.593, -0.3], [0.05, 1.593, 0.32], [0.73, 1.593, -0.3], [0.73, 1.593, 0.32]] },
  8: { size: 0.48, centres: [[-1.1, 1.55, -0.38], [-1.1, 1.55, 0.38], [-0.37, 1.55, -0.38], [-0.37, 1.55, 0.38], [0.36, 1.55, -0.38], [0.36, 1.55, 0.38], [1.09, 1.55, -0.38], [1.09, 1.549, 0.38]] },
};
export const DEPOT_BAYS: CargoBays = { size: 0.64, centres: [[-0.25, 1.081, 0.18], [0.58, 1.081, 0.18], [-0.25, 1.081, 1.07], [0.58, 1.081, 1.07]] };
