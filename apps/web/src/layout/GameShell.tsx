import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import type { RoomState } from '@vibe-rico/protocol';
import { ActionForm } from '../actions/ActionForm.js';
import { ActionPanel } from '../actions/ActionPanel.js';
import { createEventQueue, PULSE_MS } from '../animation/eventQueue.js';
import { SettingsPanel, useSettings } from '../settings/Settings.js';
import { describeOptions } from '../actions/options.js';
import { optionsForTarget, SceneInteractionProvider, targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import { GameView, rejectionText } from '../debug/GameView.js';
import { ScoreView } from '../debug/ScoreView.js';
import { describeEvent } from '../i18n/chronicle.js';
import { GOOD, PHASE, ROLE } from '../i18n/terms.js';
import { SceneBoundary, webglAvailable } from '../scene/SceneBoundary.js';
// Lazy: Three.js loads only when the 3D stage is shown (PR-055 code-splitting).
const TableScene = lazy(() => import('../scene/TableScene.js').then(m => ({ default: m.TableScene })));
import { SEAT_COLORS } from '../scene/pieces.js';
import type { GameStore } from '../state/gameStore.js';

const GOODS = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'] as const;

/** DESIGN.md layout: top bar, players, 3D harbour, turn and chronicle, the viewer's hand and actions. */
export function GameShell({ store, roomId, room }: { store: GameStore; roomId: string; room: RoomState }) {
  const latest = useStore(store, s => s.latest);
  const rejection = useStore(store, s => s.rejection);
  const connected = useStore(store, s => s.connected);
  const chronicle = useStore(store, s => s.chronicle);
  const [selected, setSelected] = useState<SceneTarget | null>(null);
  // Discrete legal options for this seat; the scene only filters them by object (PR-052).
  const options = useMemo(() => (latest?.legalActions[0] ? describeOptions(latest.legalActions[0], latest.view) ?? [] : []), [latest]);
  const actionable = useCallback((t: SceneTarget) => connected && optionsForTarget(options, t).length > 0, [options, connected]);
  // Event animation (PR-053): purely visual pulses; the scene always renders `latest`.
  const [settings, setSettings] = useSettings();
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
  const interaction = useMemo(() => ({ actionable, select: setSelected, pulse }), [actionable, pulse]);
  if (!latest) return <p>正在载入局面…</p>;
  const { view } = latest, phase = view.phase;
  const names = Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]));
  const name = (id: string) => names[id] ?? id;
  const me = view.players.find(p => p.playerId === view.viewer.playerId)!;
  const lines = chronicle.map(e => ({ key: `${e.revision}-${e.index}`, text: describeEvent(e, names) })).filter(l => l.text).slice(-20).reverse();
  return (
    <div className="shell" data-revision={latest.revision}>
      <header className="topbar">
        <h1>波多黎各</h1>
        <span>第 {view.roundNumber} 轮 · 总督 {name(view.governorPlayerId)}</span>
        <span>房间 {room.roomCode} · 版本 {latest.revision}</span>
        <SettingsPanel settings={settings} onChange={setSettings} />
      </header>

      <aside className="panel players" aria-label="玩家列表">
        <h2>玩家</h2>
        {view.players.map((p, i) => {
          const role = view.roleCards.find(c => c.selectedBy === p.playerId);
          const acting = 'actorId' in phase && phase.actorId === p.playerId;
          return (
            <section key={p.playerId} className={acting ? 'seat acting' : 'seat'}>
              <span className="medallion" style={{ background: SEAT_COLORS[i] }} aria-hidden>{name(p.playerId).slice(0, 1)}</span>
              <div>
                <strong>{name(p.playerId)}{p.playerId === view.viewer.playerId && '（你）'}{acting && '（行动中）'}</strong>
                {p.playerId === view.governorPlayerId && <span className="badge">总督</span>}
                <div>{p.coins} 金币 · {Object.values(p.goods).reduce((a, b) => a + b, 0)} 货物{role && ` · ${ROLE[role.kind]}`}</div>
                {p.playerId === view.viewer.playerId && <div>运货分 {view.viewer.earnedVp}</div>}
              </div>
            </section>
          );
        })}
      </aside>

      <main className="stage">
        <SceneInteractionProvider value={interaction}>
          <SceneBoundary><Suspense fallback={<p role="status">正在载入 3D 视图…</p>}><TableScene view={view} names={names} /></Suspense></SceneBoundary>
        </SceneInteractionProvider>
        {animating && <button className="skip" onClick={() => { queue.skip(); setPulse(null); setAnimating(false); }}>跳过动画</button>}
        <ActionPanel key={selected ? `${targetKey(selected)}@${latest.revision}` : 'none'} target={selected}
          options={selected && connected ? optionsForTarget(options, selected) : []}
          submit={o => store.getState().submit(roomId, o.action)} clear={() => setSelected(null)} />
      </main>

      <aside className="panel turn" aria-label="回合信息">
        <h2>{'actorId' in phase ? `${name(phase.actorId)} 的回合` : PHASE[phase.kind]}</h2>
        {/* Who decides, and why everyone else is waiting (PR-054). */}
        {'actorId' in phase && <p>{phase.actorId === view.viewer.playerId ? `轮到你：${PHASE[phase.kind]}` : `等待 ${name(phase.actorId)}：${PHASE[phase.kind]}`}</p>}
        {rejection && <p role="alert">{rejectionText(rejection)}</p>}
        {phase.kind === 'game-over' && <ScoreView scores={phase.scores} names={names} />}
        <h2>编年史</h2>
        <ol className="chronicle" aria-label="编年史">{lines.map(l => <li key={l.key}>{l.text}</li>)}</ol>
      </aside>

      <footer className="hand" aria-label="手牌与行动">
        <div className="cards">
          {GOODS.map(g => <div key={g} className="card"><span>{GOOD[g]}</span><strong>{me.goods[g]}</strong></div>)}
          <div className="card coin"><span>金币</span><strong>{me.coins}</strong></div>
        </div>
        <div className="actions">
          {connected
            ? <ActionForm legalActions={latest.legalActions} view={view} submit={action => store.getState().submit(roomId, action)} />
            : <p>连接已断开，暂时不能行动</p>}
        </div>
      </footer>

      <details className="text-view" open={!webglAvailable()}>
        <summary>文字界面（完整局面）</summary>
        <GameView view={view} names={names} />
      </details>
    </div>
  );
}
