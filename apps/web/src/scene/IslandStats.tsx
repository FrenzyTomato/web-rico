import { useEffect, useMemo, useState } from 'react';
import { CanvasTexture, SRGBColorSpace } from 'three';
import type { Good } from '@vibe-rico/game-engine';
import { labelWorldSize } from './labelLayout.js';
import { GOODS_MODEL } from './modelCatalog.js';
import { liveTextures } from './resources.js';

const FONT = '700 46px "Source Han Sans CN", "PingFang SC", "Microsoft YaHei", sans-serif';
const ICON = 76, LINE = 84, PAD = 24;
const icons = new Map<Good, HTMLImageElement>();
/** Mounted plaques waiting to redraw when an icon arrives; each leaves on unmount, so no scene is kept alive. */
const redraws = new Set<() => void>();
/** The same crate cutouts the players panel shows, loaded once for every island. */
function crateIcon(good: Good): HTMLImageElement {
  let img = icons.get(good);
  if (!img) {
    img = new Image();
    img.onload = () => { for (const redraw of redraws) redraw(); };
    img.src = `/art/dock/${encodeURIComponent(`${GOODS_MODEL[good]} Cutout`)}.webp`;
    icons.set(good, img);
  }
  return img;
}

/**
 * A player's coins, goods and idle workers in the open ground at the top of their island, in the players
 * panel's format ("2 coins · 1 goods · Recruiter", then crates). Drawn on a canvas and laid flat like Label;
 * the same numbers are in the DOM players panel.
 */
export function IslandStats({ summary, goods, workers, position, height = 1.15, maxWidth = Infinity }: {
  summary: string; goods: readonly { good: Good; label: string }[]; workers: string;
  position: [number, number, number]; height?: number; maxWidth?: number;
}) {
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const redraw = () => setLoaded(n => n + 1);
    redraws.add(redraw);
    return () => { redraws.delete(redraw); };
  }, []);
  useEffect(() => {
    let alive = true;
    document.fonts?.load(FONT, summary + workers).then(() => { if (alive) setLoaded(n => n + 1); }).catch(() => {});
    return () => { alive = false; };
  }, [summary, workers]);
  const key = goods.map(g => g.label).join('|');
  const { texture, canvasWidth, canvasHeight } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const g = canvas.getContext('2d')!;
    g.font = FONT;
    const items = goods.map(x => ({ ...x, img: crateIcon(x.good), width: ICON + 8 + g.measureText(x.label).width }));
    const second = [...items.map(x => x.width), g.measureText(workers).width];
    const secondWidth = second.reduce((a, b) => a + b, 0) + (second.length - 1) * 30;
    canvas.width = Math.ceil(Math.max(g.measureText(summary).width, secondWidth)) + PAD * 2;
    canvas.height = LINE * 2 + PAD;
    const draw = canvas.getContext('2d')!;
    draw.font = FONT; draw.textBaseline = 'middle'; draw.lineJoin = 'round';
    // Same ivory-on-dark silhouette as island labels, readable over sand and grass.
    const text = (s: string, x: number, y: number) => {
      draw.strokeStyle = '#102c30'; draw.lineWidth = 9; draw.strokeText(s, x, y);
      draw.fillStyle = '#fff4de'; draw.fillText(s, x, y);
    };
    text(summary, PAD, PAD / 2 + LINE / 2);
    let x = PAD;
    const y = PAD / 2 + LINE * 1.5;
    for (const item of items) {
      if (item.img.complete && item.img.naturalWidth) draw.drawImage(item.img, x, y - ICON / 2, ICON, ICON);
      text(item.label, x + ICON + 8, y);
      x += item.width + 30;
    }
    text(workers, x, y);
    liveTextures.count++;
    const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace; texture.anisotropy = 8;
    return { texture, canvasWidth: canvas.width, canvasHeight: canvas.height };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `goods`; `loaded` redraws after fonts and icons arrive
  }, [summary, key, workers, loaded]);
  useEffect(() => () => { texture.dispose(); liveTextures.count--; }, [texture]);
  const [width, worldHeight] = labelWorldSize(height, canvasWidth, canvasHeight / 2, maxWidth);
  return <mesh position={position} renderOrder={10} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[width, worldHeight * 2]} />
    {/* The open ground at the island's top rises above the mat, so the plaque draws over it (nothing else stands there). */}
    <meshBasicMaterial map={texture} transparent depthTest={false} depthWrite={false} toneMapped={false} />
  </mesh>;
}
