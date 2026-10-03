import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { labelWorldSize } from './labelLayout.js';
import { liveTextures } from './resources.js';

const FONT = '700 64px "Source Han Sans CN", "PingFang SC", "Microsoft YaHei", sans-serif';
/**
 * Text drawn onto a canvas texture and laid flat on the board: no extra React roots (drei Html remounted
 * endlessly under React 19) with the same Chinese game font as the DOM. `height` controls world-space sizing;
 * labels zoom with their models, without screen-size floors or zoom-dependent hiding.
 * Everything labelled here is also in the DOM client.
 */
export function Label({ text, position, height = 0.8, ink = '#fff4de', color = '#fff4de', maxWidth = Infinity }: {
  text: string; position: [number, number, number]; height?: number; ink?: string; color?: string; maxWidth?: number;
}) {
  const [loadedText, setLoadedText] = useState('');
  useEffect(() => {
    let alive = true;
    // Canvas labels must be redrawn after their Unicode font segments arrive.
    document.fonts?.load('700 64px "Source Han Sans CN"', text).then(() => {
      if (alive) setLoadedText(text);
    }).catch(() => { /* Keep the readable system fallback. */ });
    return () => { alive = false; };
  }, [text]);
  const { texture, canvasWidth, canvasHeight } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const measure = canvas.getContext('2d')!;
    measure.font = FONT;
    canvas.width = Math.ceil(measure.measureText(text).width) + 40;
    canvas.height = 104;
    const g = canvas.getContext('2d')!;
    g.fillStyle = color; g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    // A dark silhouette separates ivory glyphs from water, sand and forest without a backing panel.
    g.strokeStyle = '#102c30';
    g.lineWidth = 10; g.lineJoin = 'round'; g.miterLimit = 2;
    g.shadowColor = '#071b26'; g.shadowBlur = 5; g.shadowOffsetY = 3;
    g.strokeText(text, canvas.width / 2, 52);
    g.shadowColor = 'transparent';
    g.fillText(text, canvas.width / 2, 52);
    liveTextures.count++;
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8;
    return { texture, canvasWidth: canvas.width, canvasHeight: canvas.height };
  }, [text, ink, color, loadedText]);
  useEffect(() => () => { texture.dispose(); liveTextures.count--; }, [texture]);
  const [width, worldHeight] = labelWorldSize(height, canvasWidth, canvasHeight, maxWidth);
  // Buildings occlude labels naturally. Transparent glyph margins must not write depth,
  // otherwise they cut rectangular holes in island artwork.
  return <group position={position}>
    <mesh renderOrder={10} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, Number.isFinite(maxWidth) ? worldHeight / 2 : 0]}>
      <planeGeometry args={[width, worldHeight]} />
      <meshBasicMaterial map={texture} transparent depthTest depthWrite={false} toneMapped={false} />
    </mesh>
  </group>;
}
