import { Box3, Group, Mesh, Raycaster, Vector3 } from 'three';
/** Experimental fit only: terrain is generated, so matching the bounds cannot guarantee dock alignment. */
export function fitIslandTrial(source: Group, relief = 1, levelPlayAreas = false) {
  const model = source.clone(true);
  model.rotation.y += Math.PI;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model);
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3());
  model.position.sub(center);
  const root = new Group(); root.add(model);
  root.scale.set(64 / size.x, 64 / size.x * relief, 32 / size.z);
  root.updateMatrixWorld(true);
  // Place the central clearings at table height; report residual relief rather than hiding it.
  const ray = new Raycaster(), heights: number[] = [];
  for (const x of [-4, 2, 8, 14, 20]) for (const z of [1, 4, 7]) {
    ray.set(new Vector3(x, 100, z), new Vector3(0, -1, 0));
    const hit = ray.intersectObject(root, true)[0];
    if (hit) heights.push(hit.point.y);
  }
  heights.sort((a, b) => a - b);
  const ground = heights[Math.floor(heights.length / 2)] ?? 0;
  root.position.y = -ground - 0.03;
  root.updateMatrixWorld(true);
  if (levelPlayAreas) {
    // Keep the established interaction plane. Only lower terrain inside playable clearings;
    // a feathered edge preserves the surrounding raised shoreline and forest.
    const areas = [
      [-7, 28, 0, 11], // Building market and prices.
      [-22, -12, -1, 10], // Estates.
      [-19, -14, -11, -2], // Goods supply.
      [20, 27, -9, 1], // Worker register.
      [15, 22, -12, -2], // Trader depot.
      [-7, -3.8, -10, -2], [-1, 2.2, -10, -2], [5, 8.2, -10, -2], // Cargo hulls.
    ];
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.geometry = object.geometry.clone();
      const positions = object.geometry.getAttribute('position');
      const inverse = object.matrixWorld.clone().invert();
      const point = new Vector3();
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
        let weight = 0;
        for (const [left, right, top, bottom] of areas) {
          const distance = Math.max(left! - point.x, point.x - right!, top! - point.z, point.z - bottom!, 0);
          weight = Math.max(weight, Math.max(0, 1 - distance));
        }
        if (point.y > -0.03 && weight > 0) {
          point.y += (-0.03 - point.y) * weight;
          point.applyMatrix4(inverse);
          positions.setXYZ(i, point.x, point.y, point.z);
        }
      }
      positions.needsUpdate = true;
      object.geometry.computeVertexNormals();
      object.geometry.computeBoundingBox();
      object.geometry.computeBoundingSphere();
    });
  }
  return { root, heightRange: heights.length ? [heights[0]! - ground, heights.at(-1)! - ground] : [] };
}
