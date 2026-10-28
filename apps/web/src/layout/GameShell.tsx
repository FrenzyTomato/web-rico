import { useAutoProduce } from './useAutoProduce.js';
import { useTurnChime } from './useTurnChime.js';
import { HudIcon } from './HudIcon.js';
import { t, useLanguage, LanguageToggle } from '../i18n/language.js';
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { confirmedWorkers } from '@vibe-rico/game-engine';
import type { Good, RoleCardId } from '@vibe-rico/game-engine';
import type { RoomReply, RoomState } from '@vibe-rico/protocol';
import { ActionForm } from '../actions/ActionForm.js';
import { ActionPanel } from '../actions/ActionPanel.js';
import { createEventQueue, PULSE_MS } from '../animation/eventQueue.js';
import { SettingsPanel, useSettings } from '../settings/Settings.js';
import { GOODS_MODEL } from '../scene/modelCatalog.js';
import { GOODS, describeOptions } from '../actions/options.js';
import { SceneInteractionProvider, targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import type { BoardView } from '../scene/Camera.js';
import type { Action } from '../actions/options.js';
import type { WorkerDraft } from '../actions/workerDraft.js';
import { useBoardActions } from '../actions/useBoardActions.js';
import { ResourceDock, RoleHand } from './ResourceDock.js';
import { WorkerControls } from '../actions/WorkerControls.js';
import { GameView, rejectionText } from '../debug/GameView.js';
import { ScoreView } from '../debug/ScoreView.js';
import { FinalScores } from './FinalScores.js';
import { describeEvent } from '../i18n/chronicle.js';
import { moveNotice } from './moveNotice.js';
import type { MoveNotice } from './moveNotice.js';
import { actionView } from './actionView.js';
import { accountStore } from '../accounts/account.js';
import { poolKey, poolLooks } from '../scene/workerLooks.js';
import { GOOD, PHASE, ROLE } from '../i18n/terms.js';
import { SceneBoundary, webglAvailable } from '../scene/SceneBoundary.js';
// Lazy: Three.js loads only when the 3D stage is shown (PR-055 code-splitting).
const TableScene = lazy(() => import('../scene/TableScene.js').then(m => ({ default: m.TableScene })));
/** How long another player's move stays on screen; bots wait a little less than this between moves. */
const NOTICE_MS = 2500;
/** How long a new turn is announced in large type before the banner settles to one line. */
const TURN_BANNER_MS = 3000;
import { SEAT_COLORS } from '../scene/pieces.js';
import type { GameStore } from '../state/gameStore.js';

/** Narrows the normal controls to one guided move (tutorial); the rules engine still validates it. */
export interface ShellGuide {
  allowAction(action: Action): boolean;
  allowTarget(target: SceneTarget, draft: WorkerDraft | null, good: Good | null): boolean;
  /** Marks another player's move on the board while it is being shown. */
  highlight?: SceneTarget | undefined;
  guidedView?: { id: number; view: BoardView; playerId?: string };
  hintResetKey?: string;
  coach: ReactNode;
}


/** DESIGN.md layout: top bar, players, 3D harbour, turn and chronicle, the viewer's hand and actions. */
/**
 * `onRewind` asks the server to take back the viewer's role choice (live games only).
 * `onClaim` links this seat to the signed-in account, so it shows in "My games" on every device.
 */
export function GameShell({ store, roomId, room, lobbyHref, demo = false, guide, onRewind, onClaim }: { store: GameStore; roomId: string; room: RoomState; lobbyHref?: string; demo?: boolean; guide?: ShellGuide; onRewind?: (() => Promise<unknown>) | undefined; onClaim?: (() => Promise<RoomReply<null>>) | undefined }) {
  const language = useLanguage();
  const [islandRequest, setIslandRequest] = useState<{ id: number; playerId: string }>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [playersOpen, setPlayersOpen] = useState(false);
  const [chronicleOpen, setChronicleOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const signedIn = useStore(accountStore, s => s.linked);
  const [claimed, setClaimed] = useState<'idle' | 'saved' | 'failed'>('idle');
  // Game over: the results card can be put aside to look around the final map.
  const [showResults, setShowResults] = useState(true);
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
  const options = useMemo(() => (latest?.legalActions[0] ? (describeOptions(latest.legalActions[0], latest.view) ?? []).filter(o => !guide || guide.allowAction(o.action)) : []), [latest, language, guide]);
  const pending = useStore(store, s => Object.keys(s.pending).length > 0);
  const board = useBoardActions(latest, connected && !pending, options, action => store.getState().submit(roomId, action), guide?.allowTarget);
  const { selected } = board;
  // Phones: a held worker's destination is on the board, often under the sheet. Step aside while holding, return to confirm.
  const holding = Boolean(board.draft?.holding);
  const collapsedForWorker = useRef(false);
  useEffect(() => {
    // Not when placing from the keyboard list, which lives in the sheet.
    if (holding && window.matchMedia?.('(max-width: 700px)').matches && !shellRef.current?.querySelector('.hand .actions details[open]')) { collapsedForWorker.current = true; setSheetOpen(false); }
    else if (!holding && collapsedForWorker.current) { collapsedForWorker.current = false; setSheetOpen(true); }
  }, [holding]);
  // Event animation (PR-053): purely visual pulses; the scene always renders `latest`.
  const [settings, setSettings] = useSettings();
  useAutoProduce(latest, roomId, !guide && (settings.autoProduce ?? false), connected, pending, action => store.getState().submit(roomId, action));
  const yourTurn = Boolean(latest?.legalActions.length);
  useTurnChime(yourTurn, connected, settings.turnSound ?? true);
  // Each new decision of the viewer's moves the camera where it is made, as its shortcut would; later turns
  // in the same step (another load, say) leave the camera where the player put it. The tutorial steers its own camera.
  const decisionKey = latest && yourTurn ? `${latest.view.roundNumber}:${latest.view.roleSelectionIndex}:${latest.view.phase.kind}` : null;
  const actionCamera = useMemo(() => {
    const target = !guide && latest && decisionKey ? actionView(latest.view, true) : null;
    return target ? { id: latest!.revision, ...target } : undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only a new decision should move the camera
  }, [guide, decisionKey]);
  useEffect(() => { setSheetOpen(yourTurn && !demo); }, [yourTurn, latest?.view.phase.kind, demo]);
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
  // Other players' moves (bots pause between theirs) get a short line on the board, then it fades.
  const [notice, setNotice] = useState<{ key: number; text: MoveNotice } | null>(null);
  useEffect(() => {
    if (!latest || guide) return;
    const text = moveNotice(latest.events, latest.view.viewer.playerId, Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName])));
    if (!text) return;
    setNotice({ key: latest.revision, text });
    const timer = setTimeout(() => setNotice(n => n?.key === latest.revision ? null : n), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [latest, guide, room.seats]);
  // The turn banner is large for a moment whenever the turn or step changes, then settles to one compact line.
  const turnKey = latest ? `${yourTurn}:${latest.view.roundNumber}:${latest.view.roleSelectionIndex}:${latest.view.phase.kind}:${'actorId' in latest.view.phase ? latest.view.phase.actorId : ''}` : '';
  const [freshTurn, setFreshTurn] = useState(false);
  useEffect(() => {
    if (!turnKey) return;
    setFreshTurn(true);
    const timer = setTimeout(() => setFreshTurn(false), TURN_BANNER_MS);
    return () => clearTimeout(timer);
  }, [turnKey]);
  const interaction = { actionable: board.actionable, select: board.select, pulse, selectedKey: selected ? targetKey(selected) : guide?.highlight ? targetKey(guide.highlight) : null };
  if (!latest) return <p>{t("正在载入局面…")}</p>;
  const { view } = latest, phase = view.phase;
  const recruitment = phase.kind === 'recruiter-placement';
  const confirmations = recruitment ? confirmedWorkers(view) : [];
  const names = Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]));
  const name = (id: string) => names[id] ?? id;
  const me = view.players.find(p => p.playerId === view.viewer.playerId)!;
  const guidedRoles = (ids: readonly RoleCardId[]) => {
    if (!guide) return {};
    const allowedRoleIds = ids.filter(id => guide.allowAction({ kind: 'choose-role', roleCardId: id }));
    return { allowedRoleIds, highlightRoleId: allowedRoleIds[0] };
  };
  // Right after the viewer's own role choice, before anything follows it, the choice can be taken back (server checks).
  const canRewind = Boolean(onRewind) && !guide && !demo && yourTurn && connected && !pending
    && latest.events.some(e => e.kind === 'role-selected' && e.playerId === view.viewer.playerId);
  const lines = chronicle.map(e => ({ key: `${e.revision}-${e.index}`, text: describeEvent(e, names) })).filter(l => l.text).reverse();
  return (
    <SceneInteractionProvider value={interaction}>
    <div ref={shellRef} onKeyDown={event => { if (event.key === 'Escape') { setPlayersOpen(false); setChronicleOpen(false); setSettingsOpen(false); setMenuOpen(false); setTextOpen(false); } }} className={`shell${guide ? ' tutorial-shell' : ''}${menuOpen ? ' mobile-menu-open' : ''}${sheetOpen ? ' mobile-sheet-open' : ''}${textOpen ? ' mobile-text-open' : ''}`} data-revision={latest.revision}>
      <header className="topbar">
        <div className="topbar-brand"><div className="topbar-brand-line"><h1>Isles of Merchants</h1>
        {lobbyHref && <a className="back-to-lobby" href={lobbyHref}>{t('返回大厅')}</a>}</div><div className="topbar-meta">
        <span>{t('第 {0} 轮 · 总督 {1}', [view.roundNumber, name(view.governorPlayerId)])}</span>
        <span>{demo ? t('演示 · 仅供浏览') : t('房间 {0} · 版本 {1}', [room.roomCode, latest.revision])}</span></div></div>
        <span className="turn-summary" aria-live="polite" aria-atomic="true">{yourTurn && connected && <strong className="your-turn">{t("轮到你了！")}</strong>}<span>{recruitment ? t('所有玩家 · 同时分配工人') : 'actorId' in phase ? `${name(phase.actorId)} · ${PHASE[phase.kind]}` : PHASE[phase.kind]}</span></span>
        <button className="mobile-menu-button hud-icon" aria-label={t('菜单')} aria-expanded={menuOpen} aria-controls="game-tools" onClick={() => setMenuOpen(v => !v)}><span aria-hidden="true">{menuOpen ? '×' : '☰'}</span></button>
        <div className="topbar-tools" id="game-tools">
        <div className="mobile-menu-info"><strong>{demo ? t('演示 · 仅供浏览') : t('房间 {0}', [room.roomCode])}</strong><span>{t('第 {0} 轮 · 总督 {1}', [view.roundNumber, name(view.governorPlayerId)])}</span><span>{t('剩余工人')} {view.supply.workerCount} · {t('剩余分数')} {view.supply.vpRemaining}</span></div>
        <button className="hud-icon players-toggle" aria-label={t("玩家")} title={t("玩家")} aria-expanded={playersOpen} aria-controls="player-sidebar" onClick={() => { setPlayersOpen(v => !v); setChronicleOpen(false); setSettingsOpen(false); }}><HudIcon kind="players" /></button>
        <button className="hud-icon chronicle-toggle" aria-label={t("时间线")} title={t("时间线")} aria-expanded={chronicleOpen} aria-controls="chronicle-sidebar" onClick={() => { setChronicleOpen(v => !v); setPlayersOpen(false); setSettingsOpen(false); }}><HudIcon kind="history" /></button>
        <LanguageToggle iconOnly />
        <button className="mobile-text-button" onClick={() => { setTextOpen(v => !v); setMenuOpen(false); }}>{t('文字界面（完整局面）')}</button>
        {lobbyHref && <a className="mobile-lobby-link back-to-lobby" href={lobbyHref}>{t('返回大厅')}</a>}
        {onClaim && signedIn && <button className="claim-seat" disabled={claimed === 'saved'}
          onClick={() => void onClaim().then(r => setClaimed(r.ok ? 'saved' : 'failed'))}>
          {claimed === 'saved' ? t('已保存到我的账号') : claimed === 'failed' ? t('保存失败，重试') : t('保存到我的账号')}</button>}
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
        {/* Desktop: every player's stats in a row under the view shortcuts (phones keep the Players panel). */}
        <ul className="seat-strip" aria-label={t("玩家")}>
          {view.players.map((p, i) => {
            const role = view.roleCards.find(c => c.selectedBy === p.playerId);
            const acting = recruitment ? !confirmations.includes(p.playerId) : 'actorId' in phase && phase.actorId === p.playerId;
            const mine = p.playerId === view.viewer.playerId;
            return <li key={p.playerId} className={acting ? 'seat-card acting' : 'seat-card'}>
              <button title={mine ? t("查看我的岛屿") : t("查看他的岛屿")} onClick={() => setIslandRequest(previous => ({ id: (previous?.id ?? 0) + 1, playerId: p.playerId }))}>
                <span className="medallion" style={{ background: SEAT_COLORS[i] }} aria-hidden>{name(p.playerId).slice(0, 1)}</span>
                <span className="seat-card-text">
                  <strong>{name(p.playerId)}{mine && t("（你）")}{p.playerId === view.governorPlayerId && <span className="badge">{t("总督")}</span>}</strong>
                  {/* Goods show as crates on the right, so the line holds coins, role and (own) shipping points. */}
                  <span>{p.coins}{t(" 金币")}{role && ` · ${ROLE[role.kind]}`}{mine && ` · ★\u00a0${view.viewer.earnedVp}`}</span>
                </span>
                {GOODS.some(good => p.goods[good] > 0) && <span className="seat-card-goods">{GOODS.filter(good => p.goods[good] > 0).map(good => <span key={good} title={`${GOOD[good]} ×${p.goods[good]}`}>
                  <img src={`/art/dock/${encodeURIComponent(`${GOODS_MODEL[good]} Cutout`)}.webp`} alt={GOOD[good]} />{p.goods[good]}
                </span>)}</span>}
              </button>
            </li>;
          })}
        </ul>
        {/* Desktop: whose turn it is, large on the board itself rather than inside the top bar. */}
        {phase.kind !== 'game-over' && <p className={freshTurn ? 'turn-banner fresh' : 'turn-banner'} aria-live="polite" aria-atomic="true">
          {yourTurn && connected && <strong>{t("轮到你了！")}</strong>}
          <span>{recruitment ? t('所有玩家 · 同时分配工人') : 'actorId' in phase ? `${name(phase.actorId)} · ${PHASE[phase.kind]}` : PHASE[phase.kind]}</span>
        </p>}
          <SceneBoundary><Suspense fallback={<p role="status">{t("正在载入立体视图…")}</p>}><TableScene initialMobileView={demo ? 'boats' : 'mine'} islandRequest={islandRequest} guidedView={guide?.guidedView ?? actionCamera} hintResetKey={guide?.hintResetKey} hints={!guide} view={board.player ? { ...view, players: view.players.map(p => p.playerId === board.player!.playerId ? board.player! : p) } : view} names={names} /></Suspense></SceneBoundary>
        {guide?.coach}
        {rejection ? <p className="stage-alert" role="alert">{rejectionText(rejection)}</p>
          : notice && phase.kind !== 'game-over' && <div key={notice.key} className="stage-alert move-notice" role="status">
            <strong>{notice.text.title}</strong>
            {notice.text.groups.map(g => <p key={g.label || 'main'}>{g.label && <span className="move-notice-label">{g.label}</span>}{g.items.map((item, i) => <span key={i} className="move-notice-chip">{item}</span>)}</p>)}
          </div>}
        {phase.kind === 'game-over' && (showResults
          ? <FinalScores scores={phase.scores} names={names} viewerId={view.viewer.playerId} lobbyHref={lobbyHref} onShowMap={() => setShowResults(false)}
            colors={Object.fromEntries(view.players.map((p, i) => [p.playerId, SEAT_COLORS[i]!]))} />
          : <button className="show-results" onClick={() => setShowResults(true)}>{t('查看最终计分')}</button>)}
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
        <button className="mobile-sheet-toggle" aria-expanded={sheetOpen} aria-controls="hand-content" onClick={() => setSheetOpen(v => !v)}>
          <span className="sheet-grip" aria-hidden="true" />
          <span className="mobile-resource-summary"><span title={t('金币')}>🪙 {me.coins}</span><span title={t('运货分 ')}>★ {view.viewer.earnedVp}</span><span>{t('工人池')} {me.idleWorkerCount}</span>
          <span className="mobile-goods-summary">{GOODS.filter(g => me.goods[g] > 0).map(g => <span key={g} title={GOOD[g]}><img src={`/art/dock/${encodeURIComponent(`${GOODS_MODEL[g]} Cutout`)}.webp`} alt={GOOD[g]} />{me.goods[g]}</span>)}</span></span>
          <span className="mobile-sheet-caption">{demo ? t('演示 · 仅供浏览') : yourTurn ? t('轮到你了！') : t('手牌与行动')}<span aria-hidden="true">{sheetOpen ? '⌄' : '⌃'}</span></span>
        </button>
        <div id="hand-content" className="hand-content">
        <ResourceDock player={board.player ?? me} shipping={phase.kind === 'captain-loading'} looks={board.poolLooks ?? poolLooks(poolKey(me.playerId, view.roundNumber), (board.player ?? me).idleWorkerCount)} points={phase.kind === 'game-over' ? phase.scores.find(s => s.playerId === me.playerId)!.totalVp : view.viewer.earnedVp} />
        <div className="actions">
          {recruitment && <p className="recruitment-progress">{t('分配进度：{0}/{1} 已确认', [confirmations.length, view.players.length])}</p>}
          {demo ? <p role="status">{t('探索棋盘、岛屿和提示；演示中无法进行游戏操作。')}</p> : connected && !pending
            ? board.placement ? <><p>{t('同时分配你的工人；所有玩家确认后继续。')}</p><WorkerControls board={board} player={me} /></> : recruitment && confirmations.includes(me.playerId) ? <p role="status">{t('已确认分配，等待其他玩家。')}</p> : latest.legalActions[0]?.phase === 'role-selection' ? <RoleHand legal={latest.legalActions[0]} view={view} submit={action => store.getState().submit(roomId, action)} {...guidedRoles(latest.legalActions[0].roleCardIds)} /> : <ActionForm boardFirst legalActions={latest.legalActions} view={view} submit={action => store.getState().submit(roomId, action)} allow={guide?.allowAction} />
            : <p>{pending ? t("正在提交行动…") : t("连接已断开，暂时不能行动")}</p>}
          {canRewind && <button className="rewind-role" onClick={() => void onRewind!()}>{t("↩ 换一个角色")}</button>}
        </div>
        </div>
      </footer>

      <details className="text-view" open={textOpen || !webglAvailable()} onToggle={e => setTextOpen(e.currentTarget.open)}>
        <summary>{t("文字界面（完整局面）")}</summary>
        <GameView view={view} names={names} />
      </details>
    </div>
    </SceneInteractionProvider>
  );
}
