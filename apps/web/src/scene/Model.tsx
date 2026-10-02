import { useContext, useEffect, useMemo, useState } from 'react';
import { ModelOutline, OutlineColor } from './ModelOutline.js';
import { Box3, Vector3 } from 'three';
import type { Group, WebGLRenderer } from 'three';
import { useThree } from '@react-three/fiber';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { withArtBackup } from './artFallback.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { decodeModel } from './modelBytes.js';
import { box, material } from './resources.js';

// One download and shared geometry/materials per asset. Limit decoding/upload bursts.
type Library = { cache: Map<string, Promise<Group>>; ktx: KTX2Loader };
const libraries = new WeakMap<WebGLRenderer, Library>();
function library(gl: WebGLRenderer): Library {
  let result = libraries.get(gl);
  if (!result) {
    result = { cache: new Map(), ktx: new KTX2Loader().setTranscoderPath('/art/basis/').setWorkerLimit(2).detectSupport(gl) };
    libraries.set(gl, result);
  }
  return result;
}
let active = 0;
const waiting: (() => void)[] = [];
async function load(name: string, lib: Library): Promise<Group> {
  if (active >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  active++;
  try {
    async function read(folder: string, compressed: boolean) {
      const response = await fetch(`/art/${folder}/${encodeURIComponent(name)}.glb.gz`);
      if (!response.ok || !response.body) throw Error(`Model unavailable: ${name}`);
      const bytes = await decodeModel(await response.arrayBuffer());
      const loader = new GLTFLoader();
      if (compressed) loader.setKTX2Loader(lib.ktx);
      return (await loader.parseAsync(bytes, '')).scene;
    }
    const original = () => read('runtime', false);
    const scene = new URLSearchParams(location.search).get('art') === 'original'
      ? await original()
      : await withArtBackup(() => read('runtime-ktx2', true), original);
    // Hit testing is handled by simple Selectable footprints, not dense model triangles.
    scene.traverse(object => { object.raycast = () => {}; });
    return scene;
  } finally { active--; waiting.shift()?.(); }
}
function asset(name: string, gl: WebGLRenderer) {
  const lib = library(gl), cache = lib.cache;
  let pending = cache.get(name);
  if (!pending) { pending = load(name, lib).catch(error => { cache.delete(name); console.warn('Could not load board art:', name, error); throw error; }); cache.set(name, pending); }
  return pending;
}

/** Fit within width/depth/height without distorting proportions. Bottom rests at local y=0. */
export function Model({ name, width, depth = width, height = width, muted = false }: {
  name: string; width: number; depth?: number; height?: number; muted?: boolean;
}) {
  const gl = useThree(s => s.gl);
  const outlineColor = useContext(OutlineColor);
  const [loaded, setLoaded] = useState<{ name: string; scene: Group } | null>(null);
  useEffect(() => {
    let alive = true;
    asset(name, gl).then(scene => { if (alive) setLoaded({ name, scene }); }).catch(() => { /* Keep the selectable fallback available. */ });
    return () => { alive = false; };
  }, [name, gl]);
  const instance = useMemo(() => {
    if (loaded?.name !== name) return null;
    const scene = loaded.scene.clone(true);
    scene.traverse(object => { object.raycast = () => {}; });
    const bounds = new Box3().setFromObject(scene), size = bounds.getSize(new Vector3());
    const scale = Math.min(width / size.x, depth / size.z, height / size.y);
    scene.scale.multiplyScalar(scale);
    bounds.setFromObject(scene);
    const center = bounds.getCenter(new Vector3());
    scene.position.set(-center.x, -bounds.min.y, -center.z);
    return scene;
  }, [loaded, name, width, depth, height]);
  return <group scale={muted ? 0.78 : 1}>
    {instance && outlineColor && <ModelOutline instance={instance} color={outlineColor} />}
    {instance ? <primitive object={instance} dispose={null} /> : <mesh position={[0, 0.04, 0]} dispose={null}
      geometry={box(width, 0.08, depth)} material={material('#b49a70')} />}
  </group>;
}
