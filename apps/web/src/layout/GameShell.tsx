import { useAutoProduce } from './useAutoProduce.js';
import { useTurnChime } from './useTurnChime.js';
import { HudIcon } from './HudIcon.js';
import { t, useLanguage, LanguageToggle } from '../i18n/language.js';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { confirmedWorkers } from '@vibe-rico/game-engine';
import type { RoomState } from '@vibe-rico/protocol';
import { ActionForm } from '../actions/ActionForm.js';
import { ActionPanel } from '../actions/ActionPanel.js';
import { createEventQueue, PULSE_MS } from '../animation/eventQueue.js';
import { SettingsPanel, useSettings } from '../settings/Settings.js';
import { GOODS_MODEL } from '../scene/modelCatalog.js';
import { GOODS, describeOptions } from '../actions/options.js';
import { SceneInteractionProvider, targetKey } from '../scene/Selection.js';
import { useBoardActions } from '../actions/useBoardActions.js';
import { ResourceDock, RoleHand } from './ResourceDock.js';
import { WorkerControls } from '../actions/WorkerControls.js';
import { GameView, rejectionText } from '../debug/GameView.js';
import { ScoreView } from '../debug/ScoreView.js';
import { describeEvent } from '../i18n/chronicle.js';
import { GOOD, PHASE, ROLE } from '../i18n/terms.js';
import { SceneBoundary, webglAvailable } from '../scene/SceneBoundary.js';
// Lazy: Three.js loads only when the 3D stage is shown (PR-055 code-splitting).
const TableScene = lazy(() => import('../scene/TableScene.js').then(m => ({ default: m.TableScene })));
import { SEAT_COLORS } from '../scene/pieces.js';
import type { GameStore } from '../state/gameStore.js';


/** DESIGN.md layout: top bar, players, 3D harbour, turn and chronicle, the viewer's hand and actions. */
export function GameShell({ store, roomId, room, lobbyHref, demo = false }: { store: GameStore; roomId: string; room: RoomState; lobbyHref?: string; demo?: boolean }) {
  const language = useLanguage();
  const [islandRequest, setIslandRequest] = useState<{ id: number; playerId: string }>();
  const [playersOpen, setPlayersOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const latest = useStore(store, s => s.latest);
  const shellRef = useRef<HTMLDivElement>(null);
  const hasSnapshot = Boolean(latest);
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || typeof ResizeObserver === 'undefined') return;
    const header = shell.querySelector<HTMLElement>(':scope > .topbar');
    const hand = shell.querySelector<HTMLElement>(':scope > .hand');
    const text = shell.querySelector<HTMLElement>(':scope > .text-view');
    const update = () => {
      shell.style.setProperty('--hud-top', `${(header?.offsetHeight ?? 52) + 20}px`);
      shell.style.setProperty('--hud-bottom', `${(hand?.offsetHeight ?? 170) + (text?.offsetHeight ?? 32) + 32}px`);
    };
    const observer = new ResizeObserver(update);
    for (const element of [header, hand, text]) if (element) observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [hasSnapshot]);
  const rejection = useStore(store, s => s.rejection);
  const connected = useStore(store, s => s.connected);
  const chronicle = useStore(store, s => s.chronicle);
  // Discrete legal options for this seat; the scene only filters them by object (PR-052).
  const options = useMemo(() => (latest?.legalActions[0] ? describeOptions(latest.legalActions[0], latest.view) ?? [] : []), [latest, language]);
  const pending = useStore(store, s => Object.keys(s.pending).length > 0);
  const board = useBoardActions(latest, connected && !pending, options, action => store.getState().submit(roomId, action));
  const { selected } = board;
  // Event animation (PR-053): purely visual pulses; the scene always renders `latest`.
  const [settings, setSettings] = useSettings();
  useAutoProduce(latest, roomId, settings.autoProduce ?? false, connected, pending, action => store.getState().submit(roomId, action));
  const yourTurn = Boolean(latest?.legalActions.length);
  useTurnChime(yourTurn, connected, settings.turnSound ?? true);
  // Reduced motion: a zero-length queue shows no pulses at all (PR-054).
  const queue = useMemo(() => createEventQueue(settings.reducedMotion ? 0 : PULSE_MS), [settings.reducedMotion]);
  const [pulse, setPulse] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  useEffect(() => {
    if (!latest) return;
    queue.accept(latest);
    const tick = () => { setPulse(queue.active(performance.now())); setAnimating(queue.busy()); };
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [latest, queue]);
  const interaction = { actionable: board.actionable, select: board.select, pulse, selectedKey: selected ? targetKey(selected) : null };
  if (!latest) return <p>{t("正在载入局面…")}</p>;
  const { view } = latest, phase = view.phase;
  const recruitment = phase.kind === 'recruiter-placement';
  const confirmations = recruitment ? confirmedWorkers(view) : [];
  const names = Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]));
  const name = (id: string) => names[id] ?? id;
  const me = view.players.find(p => p.playerId === view.viewer.playerId)!;
  const lines = chronicle.map(e => ({ key: `${e.revision}-${e.index}`, text: describeEvent(e, names) })).filter(l => l.text).slice(-20).reverse();
  return (
    <SceneInteractionProvider value={interaction}>
    <div ref={shellRef} onKeyDown={event => { if (event.key === 'Escape') { setPlayersOpen(false); setChronicleOpen(false); setSettingsOpen(false); } }} className="shell" data-revision={latest.revision}>
      <header className="topbar">
        <div className="topbar-brand"><div className="topbar-brand-line"><h1>Web Rico</h1>
        {lobbyHref && <a className="back-to-lobby" href={lobbyHref}>{t('返回大厅')}</a>}</div><div className="topbar-meta">
        <span>{t('第 {0} 轮 · 总督 {1}', [view.roundNumber, name(view.governorPlayerId)])}</span>
        <span>{demo ? t('演示 · 仅供浏览') : t('房间 {0} · 版本 {1}', [room.roomCode, latest.revision])}</span></div></div>
        <span className="turn-summary" aria-live="polite" aria-atomic="true">{yourTurn && connected && <strong className="your-turn">{t("轮到你了！")}</strong>}<span>{recruitment ? t('所有玩家 · 同时分配工人') : 'actorId' in phase ? `${name(phase.actorId)} · ${PHASE[phase.kind]}` : PHASE[phase.kind]}</span></span>
        <div className="topbar-tools">
        <button className="hud-icon" aria-label={t("玩家")} title={t("玩家")} aria-expanded={playersOpen} aria-controls="player-sidebar" onClick={() => { setPlayersOpen(v => !v); setChronicleOpen(false); setSettingsOpen(false); }}><HudIcon kind="players" /></button>
        <button className="hud-icon" aria-label={t("时间线")} title={t("时间线")} aria-expanded={chronicleOpen} aria-controls="chronicle-sidebar" onClick={() => { setChronicleOpen(v => !v); setPlayersOpen(false); setSettingsOpen(false); }}><HudIcon kind="history" /></button>
        <LanguageToggle iconOnly />
        <SettingsPanel settings={settings} onChange={setSettings} iconOnly portalHost={shellRef.current} open={settingsOpen} onOpenChange={open => { setSettingsOpen(open); setPlayersOpen(false); setChronicleOpen(false); }} />
        </div>
      </header>

      <aside id="player-sidebar" hidden={!playersOpen} className="panel players" aria-label={t("玩家列表")}>
        <h2>{t("玩家")}</h2>
        {view.players.map((p, i) => {
          const role = view.roleCards.find(c => c.selectedBy === p.playerId);
          const acting = recruitment ? !confirmations.includes(p.playerId) : 'actorId' in phase && phase.actorId === p.playerId;
          return (
            <section key={p.playerId} className={acting ? 'seat acting' : 'seat'}>
              <span className="medallion" style={{ background: SEAT_COLORS[i] }} aria-hidden>{name(p.playerId).slice(0, 1)}</span>
              <div>
                <strong>{name(p.playerId)}{p.playerId === view.viewer.playerId && t("（你）")}{acting && t("（行动中）")}</strong>
                {p.playerId === view.governorPlayerId && <span className="badge">{t("总督")}</span>}
                <div>{p.coins}{t(" 金币 · ")}{Object.values(p.goods).reduce((a, b) => a + b, 0)}{t(" 货物")}{role && ` · ${ROLE[role.kind]}`}</div>
                <ul className="seat-goods" aria-label={t("货物")}>
                  {GOODS.filter(good => p.goods[good] > 0).map(good => <li key={good} title={`${GOOD[good]} ×${p.goods[good]}`}>
                    <img src={`/art/dock/${encodeURIComponent(`${GOODS_MODEL[good]} Cutout`)}.webp`} alt="" />
                    <span>{GOOD[good]} <b>×{p.goods[good]}</b></span>
                  </li>)}
                </ul>
                {p.playerId === view.viewer.playerId && <div>{t("运货分 ")}{view.viewer.earnedVp}</div>}
                <button className="check-island" onClick={() => {
                  setIslandRequest(previous => ({ id: (previous?.id ?? 0) + 1, playerId: p.playerId }));
                  setPlayersOpen(false);
                }}>{p.playerId === view.viewer.playerId ? t("查看我的岛屿") : t("查看他的岛屿")}</button>
              </div>
            </section>
          );
        })}
      </aside>

      <main className="stage">
        <dl className="supply-hud" aria-label={t("公共储备")}>
          <div><dt>{t("剩余工人")}</dt><dd>{view.supply.workerCount}</dd></div>
          <div><dt><span aria-hidden="true">★ </span>{t("剩余分数")}</dt><dd>{view.supply.vpRemaining}</dd></div>
        </dl>
          <SceneBoundary><Suspense fallback={<p role="status">{t("正在载入立体视图…")}</p>}><TableScene islandRequest={islandRequest} view={board.player ? { ...view, players: view.players.map(p => p.playerId === board.player!.playerId ? board.player! : p) } : view} names={names} /></Suspense></SceneBoundary>
        {rejection && <p className="stage-alert" role="alert">{rejectionText(rejection)}</p>}
        {phase.kind === 'game-over' && <div className="final-scores"><ScoreView scores={phase.scores} names={names} /></div>}
        {animating && <button className="skip" onClick={() => { queue.skip(); setPulse(null); setAnimating(false); }}>{t("跳过动画")}</button>}
        {selected?.kind === 'crate' && <div className="action-panel" role="status">{t("已选择 ")}{GOOD[selected.good]}{t("：点击船或交易所。")}<button onClick={board.clear}>{t("取消选择")}</button></div>}
        <ActionPanel key={selected ? `${targetKey(selected)}@${latest.revision}` : 'none'} target={selected?.kind === 'crate' || selected?.kind === 'worker' ? null : selected}
          options={board.panelOptions}
          submit={o => store.getState().submit(roomId, o.action)} clear={board.clear} />
      </main>

      <aside id="chronicle-sidebar" hidden={!chronicleOpen} className="panel turn" aria-label={t("回合信息")}>
        <h2>{recruitment ? t('所有玩家 · 同时分配工人') : 'actorId' in phase ? t("{0} 的回合", [name(phase.actorId)]) : PHASE[phase.kind]}</h2>
        {/* Who decides, and why everyone else is waiting (PR-054). */}
        {!recruitment && 'actorId' in phase && <p>{phase.actorId === view.viewer.playerId ? t("轮到你：{0}", [PHASE[phase.kind]]) : t("等待 {0}：{1}", [name(phase.actorId), PHASE[phase.kind]])}</p>}
        {rejection && <p role="alert">{rejectionText(rejection)}</p>}
        {phase.kind === 'game-over' && <ScoreView scores={phase.scores} names={names} />}
        <h2>{t("时间线")}</h2>
        <ol className="chronicle" aria-label={t("时间线")}>{lines.map(l => <li key={l.key}>{l.text}</li>)}</ol>
      </aside>

      <footer className="hand" aria-label={t("手牌与行动")}>
        <ResourceDock player={board.player ?? me} points={phase.kind === 'game-over' ? phase.scores.find(s => s.playerId === me.playerId)!.totalVp : view.viewer.earnedVp} />
        <div className="actions">
          {recruitment && <p className="recruitment-progress">{t('分配进度：{0}/{1} 已确认', [confirmations.length, view.players.length])}</p>}
          {demo ? <p role="status">{t('探索棋盘、岛屿和提示；演示中无法进行游戏操作。')}</p> : connected && !pending
            ? board.placement ? <><p>{t('同时分配你的工人；所有玩家确认后继续。')}</p><WorkerControls board={board} player={me} /></> : recruitment && confirmations.includes(me.playerId) ? <p role="status">{t('已确认分配，等待其他玩家。')}</p> : latest.legalActions[0]?.phase === 'role-selection' ? <RoleHand legal={latest.legalActions[0]} view={view} submit={action => store.getState().submit(roomId, action)} /> : <ActionForm boardFirst legalActions={latest.legalActions} view={view} submit={action => store.getState().submit(roomId, action)} />
            : <p>{pending ? t("正在提交行动…") : t("连接已断开，暂时不能行动")}</p>}
        </div>
      </footer>

      <details className="text-view" open={!webglAvailable()}>
        <summary>{t("文字界面（完整局面）")}</summary>
        <GameView view={view} names={names} />
      </details>
    </div>
    </SceneInteractionProvider>
  );
}
