import { t, useLanguage } from '../i18n/language.js';
import { useCallback, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { PlayerView } from '@vibe-rico/protocol';
import { Camera } from './Camera.js';
import type { BoardView, CameraCommand } from './Camera.js';
import { CommonBoard } from './CommonBoard.js';
import { PlayerBoard } from './PlayerBoard.js';
import { HoverHint } from './ModelHint.js';
import type { PieceHint } from './effects.js';
import { TargetProbe } from './Selectable.js';
import { SEAT_COLORS } from './pieces.js';

import { ARCHIPELAGO, ISLAND_SEATS } from './archipelago.js';
import { Island, Ocean } from './Environment.js';
export const TABLE = ARCHIPELAGO;

/**
 * Seat positions around the shared market, clockwise in seat order (seen from above), with the viewer's seat at the
 * front edge nearest the camera. Pure, so layouts for 3/4/5 players are testable without WebGL.
 */
export function seatPositions(seatOrder: readonly string[], viewerId: string) {
  const n = seatOrder.length, viewer = seatOrder.indexOf(viewerId);
  return seatOrder.map((playerId, i) => {
    const [x, z] = ISLAND_SEATS[n]![((i - viewer) % n + n) % n]!;
    return { playerId, x, z };
  });
}

/**
 * On-demand rendering redraws only when invalidated. The browser may discard the canvas image (hidden tab,
 * compositor), so redraw on every view change and on visibility, plus a 1 fps safety net.
 */
function Redraw({ view }: { view: PlayerView }) {
  const language = useLanguage();
  const invalidate = useThree(s => s.invalidate);
  useEffect(() => { invalidate(); }, [view, language, invalidate]);
  useEffect(() => {
    const onVisible = () => invalidate();
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(invalidate, 1000);
    return () => { document.removeEventListener('visibilitychange', onVisible); clearInterval(timer); };
  }, [invalidate]);
  return null;
}

/** A central harbour island and individual player islands surrounded by continuous ocean. */
export function TableScene({ view, names, frameloop = 'demand' }: {
  view: PlayerView; names: Readonly<Record<string, string>>; frameloop?: 'demand' | 'always';
}) {
  const language = useLanguage();
  // WebGL context loss (PR-055): three.js restores its own state; show a notice while lost, redraw after.
  const [hint, setHint] = useState<PieceHint | null>(null);
  useEffect(() => { setHint(null); }, [language]);
  const showHint = useCallback((next: PieceHint | null) => setHint(current => current?.title === next?.title ? current : next), []);
  const [lost, setLost] = useState(false);
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({ id: 0, view: 'shared' });
  const [focus, setFocus] = useState<BoardView>('shared');
  const focusView = (view: BoardView) => { setFocus(view); setCameraCommand(c => ({ id: c.id + 1, view })); };

  return (
    <div className="scene" aria-label={t("桌面")}>
      <div className="board-camera" role="group" aria-label={t("棋盘视角")}>
        {([['shared', t("公共区")], ['buildings', t("建筑市场")], ['boats', t("货船")], ['depot', t("交易所")], ['estates', t("可选田园")], ['mine', t("我的岛屿")], ['overview', t("全桌")]] as const).map(([mode, label]) =>
          <button key={mode} aria-pressed={focus === mode} onClick={() => focusView(mode)}>{label}</button>)}
        <button aria-label={t("放大棋盘")} onClick={() => setCameraCommand(c => ({ id: c.id + 1, zoom: 0.9 }))}>＋</button>
        <button aria-label={t("缩小棋盘")} onClick={() => setCameraCommand(c => ({ id: c.id + 1, zoom: 1 / 0.9 }))}>−</button>
        <span>{t("滚轮缩放 · 左键平移 · 右键旋转")}</span>
      </div>
      {lost && <p role="note">{t("立体视图暂时不可用，正在恢复…")}</p>}
      {/* Redraw only when props change: a board game is static between states (continuous 60 fps starved e2e tabs). */}
      {hint && <div className="model-tooltip" role="tooltip"><strong>{hint.title}</strong><p>{hint.detail}</p><small>{hint.meta}</small></div>}
      <HoverHint.Provider value={showHint}>
      <Canvas gl={{ stencil: true }} camera={{ fov: 45, near: 0.1, far: 1000 }} dpr={[1, 2]} frameloop={frameloop} onCreated={({ gl, invalidate }) => {
        gl.domElement.addEventListener('webglcontextlost', () => setLost(true));
        gl.domElement.addEventListener('webglcontextrestored', () => { setLost(false); invalidate(); });
      }}>
        <color attach="background" args={['#2f7f86']} />
        <Camera command={cameraCommand} />
        <Redraw view={view} />
        {import.meta.env.DEV && <TargetProbe />}
        <hemisphereLight args={['#fff3da', '#587877', 1.7]} />
        <directionalLight position={[8, 20, 10]} intensity={2.5} color="#fff1d6" />
        <Ocean />
        <Island />
        <CommonBoard view={view} names={names} />
        {seatPositions(view.seatOrder, view.viewer.playerId).map((seat, i) => (
          <group key={seat.playerId} position={[seat.x, 0, seat.z]}>
            <PlayerBoard player={view.players[i]!} color={SEAT_COLORS[i]!} mine={seat.playerId === view.viewer.playerId}
              title={`${names[seat.playerId] ?? seat.playerId}${seat.playerId === view.governorPlayerId ? t("（总督）") : ''}${seat.playerId === view.viewer.playerId ? t("（你）") : ''}`} />
          </group>
        ))}
      </Canvas>
      </HoverHint.Provider>
    </div>
  );
}
