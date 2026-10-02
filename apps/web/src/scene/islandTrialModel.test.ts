import { describe, expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { fitIslandTrial } from './islandTrialModel.js';

describe('main island terrain', () => {
  it('levels playable land without changing the cached source geometry', () => {
    const geometry = new PlaneGeometry(64, 32, 32, 16);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) positions.setY(i, Math.sin(positions.getX(i)) * .5 + .5);
    const before = Array.from(positions.array);
    const source = new Group(); source.add(new Mesh(geometry, new MeshBasicMaterial()));
    const { root } = fitIslandTrial(source, .35, true);
    expect(Array.from(positions.array)).toEqual(before);
    let checked = 0;
    root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      expect(object.geometry).not.toBe(geometry);
      const vertices = object.geometry.getAttribute('position');
      for (let i = 0; i < vertices.count; i++) {
        const point = new Vector3().fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld);
        if (point.x > -6 && point.x < 27 && point.z > 1 && point.z < 10) {
          expect(point.y).toBeLessThanOrEqual(-.02999); checked++;
        }
      }
    });
    expect(checked).toBeGreaterThan(10);
  });
});
