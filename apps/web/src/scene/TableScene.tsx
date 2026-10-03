import { MobileAreaPicker } from './MobileAreaPicker.js';
import { ModelLibraryLifecycle } from './Model.js';
import { t, useLanguage } from '../i18n/language.js';
import { useCallback, useEffect, useRef, useState } from 'react';
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
export function TableScene({ view, names, islandRequest, guidedView, initialMobileView = 'boats', frameloop = 'demand' }: {
  guidedView?: { id: number; view: BoardView };
  initialMobileView?: BoardView; view: PlayerView; names: Readonly<Record<string, string>>; islandRequest?: { id: number; playerId: string } | undefined; frameloop?: 'demand' | 'always';
}) {
  const language = useLanguage();
  // WebGL context loss (PR-055): three.js restores its own state; show a notice while lost, redraw after.
  const [hint, setHint] = useState<PieceHint | null>(null);
  useEffect(() => { setHint(null); }, [language]);
  const showHint = useCallback((next: PieceHint | null) => setHint(current => current?.title === next?.title && current?.detail === next?.detail && current?.meta === next?.meta ? current : next), []);
  const [touchRotate, setTouchRotate] = useState(false);
  const [lost, setLost] = useState(false);
  const [initialView] = useState<BoardView>(() => window.matchMedia?.('(max-width: 700px)').matches ? initialMobileView : 'shared');
  const [cameraCommand, setCameraCommand] = useState<CameraCommand>({ id: 0, view: initialView });
  const [focus, setFocus] = useState<BoardView>(initialView);
  const [focusedPlayer, setFocusedPlayer] = useState<string | null>(initialView === 'mine' ? view.viewer.playerId : null);
  const focusView = (view: BoardView) => { setFocusedPlayer(null); setFocus(view); setCameraCommand(c => ({ id: c.id + 1, view })); };
  useEffect(() => {
    if (!guidedView) return;
    setHint(null); setFocusedPlayer(null); setFocus(guidedView.view);
    setCameraCommand(c => ({ id: c.id + 1, view: guidedView.view }));
  }, [guidedView]);

  const focusIsland = useCallback((playerId: string) => {
    const seat = seatPositions(view.seatOrder, view.viewer.playerId).find(s => s.playerId === playerId);
    if (!seat) return;
    setFocusedPlayer(playerId);
    setFocus('mine');
    setCameraCommand(c => ({ id: c.id + 1, view: 'mine', island: { x: seat.x, z: seat.z } }));
  }, [view.seatOrder, view.viewer.playerId]);
  const lastIslandRequest = useRef<number | null>(null);
  useEffect(() => {
    if (!islandRequest || lastIslandRequest.current === islandRequest.id) return;
    lastIslandRequest.current = islandRequest.id;
    focusIsland(islandRequest.playerId);
  }, [islandRequest, focusIsland]);

  return (
    <div className="scene" onPointerDownCapture={e => { if (e.pointerType === 'touch' && e.target instanceof HTMLCanvasElement) setHint(null); }} onContextMenu={e => { if (window.matchMedia('(max-width: 700px)').matches) e.preventDefault(); }} aria-label={t("桌面")}>
      <div className="board-camera desktop-camera" role="group" aria-label={t("棋盘视角")}>
        {([['shared', t("公共区")], ['buildings', t("建筑市场")], ['boats', t("货船")], ['depot', t("交易所")], ['estates', t("可选田园")], ['overview', t("全桌")]] as const).map(([mode, label]) =>
          <button key={mode} aria-pressed={!focusedPlayer && focus === mode} onClick={() => focusView(mode)}>{label}</button>)}
        {view.seatOrder.map(id => <button key={id} aria-pressed={focusedPlayer === id}
          aria-label={t("查看 {0} 的岛屿", [names[id] ?? id])} onClick={() => focusIsland(id)}>
          {id === view.viewer.playerId ? t("我的岛屿") : t("{0} 的岛屿", [names[id] ?? id])}
        </button>)}
        <span>{t("滚轮缩放 · 左键平移 · 右键旋转")}</span>
      </div>
      <MobileAreaPicker value={focusedPlayer ? `island:${focusedPlayer}` : focus.startsWith('buildings-') ? 'buildings' : focus}
        options={[
          ...([['shared', t('公共区')], ['buildings', t('建筑市场')], ['boats', t('货船')], ['depot', t('交易所')], ['estates', t('可选田园')], ['overview', t('全桌')]] as const).map(([value, label]) => ({ value, label })),
          ...view.seatOrder.map(id => ({ value: `island:${id}`, label: id === view.viewer.playerId ? t('我的岛屿') : t('{0} 的岛屿', [names[id] ?? id]) })),
        ]} onChange={value => {
          if (value.startsWith('island:')) focusIsland(value.slice(7));
          else focusView(value === 'buildings' ? 'buildings-1' : value as BoardView);
        }} />
      {focus.startsWith('buildings') && <div className="board-camera mobile-building-tiers" role="group" aria-label={t('建筑市场')}>
        {[1, 2, 3, 4].map(cap => <button key={cap} aria-pressed={focus === `buildings-${cap}`} onClick={() => { setHint(null); focusView(`buildings-${cap}` as BoardView); }}>{t('最高折扣：{0}', [cap])}</button>)}
      </div>}
      <div className="board-camera board-zoom" role="group" aria-label={t("棋盘缩放")}>
        <button className="mobile-rotate-toggle" aria-label={t('旋转视角')} aria-pressed={touchRotate} title={touchRotate ? t('拖动旋转；轻触切回平移') : t('轻触后拖动旋转视角')} onClick={() => setTouchRotate(v => !v)}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 8a9 9 0 0 0-15-3L2 8m0-5v5h5M4 16a9 9 0 0 0 15 3l3-3m0 5v-5h-5" /></svg>
        </button>
        <button aria-label={t("放大棋盘")} onClick={() => setCameraCommand(c => ({ id: c.id + 1, zoom: 0.9 }))}>＋</button>
        <button aria-label={t("缩小棋盘")} onClick={() => setCameraCommand(c => ({ id: c.id + 1, zoom: 1 / 0.9 }))}>−</button>
      </div>
      {lost && <p role="note">{t("立体视图暂时不可用，正在恢复…")}</p>}
      {/* Redraw only when props change: a board game is static between states (continuous 60 fps starved e2e tabs). */}
      {hint && <div className={`model-tooltip${hint.kind === 'building' ? ' building-tooltip' : ''}`} role="tooltip"><button className="mobile-hint-close" aria-label={t('关闭提示')} onClick={() => setHint(null)}>×</button><strong>{hint.title}</strong><p>{hint.detail}</p><small>{hint.meta}</small></div>}
      <HoverHint.Provider value={showHint}>
      <Canvas gl={{ stencil: true }} camera={{ fov: 45, near: 0.1, far: 1000 }} dpr={[1, 2]} frameloop={frameloop} onCreated={({ gl, invalidate }) => {
        gl.domElement.addEventListener('webglcontextlost', () => setLost(true));
        gl.domElement.addEventListener('webglcontextrestored', () => { setLost(false); invalidate(); });
      }}>
        <color attach="background" args={['#2f7f86']} />
        <ModelLibraryLifecycle />
        <Camera command={cameraCommand} touchRotate={touchRotate} />
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
