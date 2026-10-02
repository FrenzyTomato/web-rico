import { createContext, useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { AlwaysStencilFunc, BackSide, Color, DoubleSide, MeshBasicMaterial, NotEqualStencilFunc, ReplaceStencilOp, ShaderMaterial, Vector2 } from 'three';
import type { Group, Mesh } from 'three';

export const OutlineColor = createContext<string | null>(null);

/** A glossy screen-space stroke, sharing the original geometry and silhouette mask. */
export function ModelOutline({ instance, color }: { instance: Group; color: string }) {
  const size = useThree(s => s.size);
  const material = useMemo(() => new ShaderMaterial({
    side: BackSide, depthWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: NotEqualStencilFunc,
    uniforms: { ink: { value: new Color(color) }, viewport: { value: new Vector2(size.width, size.height) } },
    vertexShader: `uniform vec2 viewport;
      varying float shine;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec2 projectedNormal = (projectionMatrix * vec4(normalize(normalMatrix * normal), 0.0)).xy;
        vec2 direction = projectedNormal / max(length(projectedNormal), 0.001);
        shine = pow(max(dot(direction, normalize(vec2(-0.6, 0.8))), 0.0), 5.0);
        clip.xy += direction * 9.0 / viewport * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 ink; varying float shine;
      void main() {
        gl_FragColor = vec4(mix(ink, vec3(0.82, 1.0, 0.92), shine * 0.8), 1.0);
        #include <colorspace_fragment>
      }`,
  }), []);
  material.uniforms.ink!.value.set(color);
  material.uniforms.viewport!.value.set(size.width, size.height);
  // Mask the entire silhouette before drawing expanded hulls. This prevents the
  // many individual leaves/roof pieces from painting strokes across the model.
  const maskMaterial = useMemo(() => new MeshBasicMaterial({
    side: DoubleSide, colorWrite: false, depthWrite: false, stencilWrite: true,
    stencilRef: 1, stencilFunc: AlwaysStencilFunc, stencilZPass: ReplaceStencilOp,
  }), []);
  const mask = useMemo(() => {
    const copy = instance.clone(true);
    copy.traverse(object => {
      object.raycast = () => {};
      if ((object as Mesh).isMesh) {
        (object as Mesh).material = maskMaterial; object.renderOrder = 1;
        object.castShadow = false; object.receiveShadow = false;
      }
    });
    return copy;
  }, [instance, maskMaterial]);
  const hull = useMemo(() => {
    const copy = instance.clone(true);
    copy.traverse(object => {
      object.raycast = () => {};
      if ((object as Mesh).isMesh) {
        (object as Mesh).material = material;
        object.renderOrder = 2;
        object.castShadow = false; object.receiveShadow = false;
      }
    });
    return copy;
  }, [instance, material]);
  useEffect(() => () => { material.dispose(); maskMaterial.dispose(); }, [material, maskMaterial]);
  return <><primitive object={mask} dispose={null} /><primitive object={hull} dispose={null} /></>;
}
