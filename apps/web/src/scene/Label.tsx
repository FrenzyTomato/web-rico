import { useEffect, useMemo } from 'react';
import { CanvasTexture } from 'three';
import { liveTextures } from './resources.js';

const FONT = 'bold 64px "Songti SC", "Noto Serif SC", serif';
/**
 * Text drawn onto a canvas texture and shown as a sprite: no extra React roots (drei Html remounted
 * endlessly under React 19) and no font download. `height` is in world units; width follows the text.
 * Everything labelled here is also in the DOM client.
 */
export function Label({ text, position, height = 0.8, ink = '#2a2118', paper = '#efe4cc' }: {
  text: string; position: [number, number, number]; height?: number; ink?: string; paper?: string;
}) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const measure = canvas.getContext('2d')!;
    measure.font = FONT;
    canvas.width = Math.ceil(measure.measureText(text).width) + 48;
    canvas.height = 112;
    const g = canvas.getContext('2d')!;
    g.fillStyle = paper; g.fillRect(0, 0, canvas.width, canvas.height);
    g.strokeStyle = '#c9a45c'; g.lineWidth = 8; g.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    g.fillStyle = ink; g.font = FONT; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
    liveTextures.count++;
    return { texture: new CanvasTexture(canvas), aspect: canvas.width / canvas.height };
  }, [text, ink, paper]);
  useEffect(() => () => { texture.dispose(); liveTextures.count--; }, [texture]);
  return <sprite position={position} scale={[height * aspect, height, 1]}><spriteMaterial map={texture} /></sprite>;
}
