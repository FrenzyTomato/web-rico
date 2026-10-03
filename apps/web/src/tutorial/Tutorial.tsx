import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from 'zustand';
import { LanguageToggle, useLanguage } from '../i18n/language.js';
import { BUILDING, GOOD, ROLE, TILE } from '../i18n/terms.js';
import { describeOptions } from '../actions/options.js';
import type { Action } from '../actions/options.js';
import { useBoardActions } from '../actions/useBoardActions.js';
import { allocationAction } from '../actions/workerDraft.js';
import { SceneInteractionProvider, targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import { ResourceDock } from '../layout/ResourceDock.js';
import { SceneBoundary } from '../scene/SceneBoundary.js';
import { allowedTargets, createTutorialController, lesson, sameAction } from './controller.js';
import { copy } from './copy.js';

const TableScene = lazy(() => import('../scene/TableScene.js').then(m => ({ default: m.TableScene })));
const names = { alice: 'You', bruno: 'Bruno', chen: 'Chen' };

export function Tutorial() {
  const [controller] = useState(createTutorialController);
  const { generation, index, stage, snapshot } = useStore(controller);
  useEffect(() => {
    controller.getState().reset();
    const hide = () => controller.getState().dispose();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) controller.getState().reset(); };
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', restore);
    return () => { hide(); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', restore); };
  }, [controller]);
  const exit = () => { controller.getState().dispose(); window.location.assign('/?lobby=1'); };
  if (!snapshot || stage === 'disposed') return null;
  return <Lesson key={generation} index={index} stage={stage} snapshot={snapshot}
    submit={action => controller.getState().submit(generation, lesson[index]!.id, snapshot.revision, action)}
    next={() => controller.getState().next(generation, index)} exit={exit} />;
}

function Lesson({ index, stage, snapshot, submit, next, exit }: {
  index: number; stage: 'action' | 'result' | 'finished'; snapshot: NonNullable<ReturnType<ReturnType<typeof createTutorialController>['getState']>['snapshot']>;
  submit: (action: Action) => boolean; next: () => void; exit: () => void;
}) {
  const language = useLanguage(), lang = language === 'zh' ? 1 : 0;
  const text = (en: string, zh: string) => lang ? zh : en;
  const step = lesson[index]!, words = copy[step.id]!;
  const options = useMemo(() => {
    const legal = snapshot.legalActions[0];
    return legal ? (describeOptions(legal, snapshot.view) ?? []).filter(o => sameAction(o.action, step.action)) : [];
  }, [snapshot, step, language]);
  const board = useBoardActions(snapshot, stage === 'action', options, submit,
    (target, draft, good) => allowedTargets(step, draft, good).some(t => targetKey(t) === targetKey(target)));
  const targets = stage === 'action' ? allowedTargets(step, board.draft, board.good).filter(board.actionable) : [];
  const [focusId, setFocusId] = useState(0);
  const guidedView = useMemo(() => ({ id: focusId, view: words.camera }), [focusId, words, stage]);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  useEffect(() => { titleRef.current?.focus({ preventScroll: true }); }, [index, stage]);
  useEffect(() => {
    const shell = shellRef.current, hand = shell?.querySelector('footer');
    if (!shell || !hand) return;
    const update = () => shell.style.setProperty('--hud-bottom', `${hand.getBoundingClientRect().height + 28}px`);
    update();
    const observer = new ResizeObserver(update); observer.observe(hand);
    return () => observer.disconnect();
  }, []);
  const me = board.player ?? snapshot.view.players.find(p => p.playerId === 'alice')!;
  const view = { ...snapshot.view, players: snapshot.view.players.map(p => p.playerId === 'alice' ? me : p) };
  const label = (target: SceneTarget): string => {
    if (target.kind === 'role') return ROLE[view.roleCards.find(c => c.instanceId === target.id)!.kind];
    if (target.kind === 'building') return BUILDING[target.type as keyof typeof BUILDING];
    if (target.kind === 'estate') return TILE[view.estateMarket.find(t => t.instanceId === target.id)!.kind];
    if (target.kind === 'tile') return `${text('Place on', '放置到')} ${TILE[me.countryside.find(t => t.instanceId === target.id)!.kind]}`;
    if (target.kind === 'owned-building') return `${text('Place in', '放置到')} ${BUILDING[me.buildings.find(b => b.instanceId === target.id)!.buildingTypeId]}`;
    if (target.kind === 'worker') return target.id === 'pool' ? text('Select pool worker', '选择池中工人') : text('Pick up fruit-estate worker', '拿起水果田园工人');
    if (target.kind === 'crate') return `${text('Select', '选择')} ${GOOD[target.good]}`;
    if (target.kind === 'good') return GOOD[target.good];
    if (target.kind === 'depot') return text('Trading depot', '交易所');
    if (target.kind === 'ship') return text('Ship corn', '运送玉米');
    return '';
  };
  const draftAction = board.placement && board.draft ? allocationAction(board.placement, board.draft) : null;
  const canConfirm = stage === 'action' && (step.action.kind === 'allocate-workers'
    ? Boolean(draftAction && sameAction(draftAction, step.action))
    : step.action.kind === 'produce' || Boolean(board.selected && board.panelOptions.length));
  const select = (target: SceneTarget) => { board.select(target); };
  const instruction = stage === 'action' ? words.instruction[lang] : words.result[lang];
  return <SceneInteractionProvider value={{ actionable: board.actionable, select, pulse: null,
    selectedKey: board.selected ? targetKey(board.selected) : null,
    inspect: target => stage === 'action' && !!target && (board.actionable(target) || (board.selected !== null && targetKey(target) === targetKey(board.selected))),
  }}>
    <div ref={shellRef} className="shell tutorial-shell" data-tutorial-step={step.id} data-tutorial-stage={stage}>
      <header className="topbar"><div><h1>Web Rico</h1><small>{text('Learn to play', '学习游戏')} · {index + 1}/{lesson.length}</small></div>
        <div className="tutorial-tools"><LanguageToggle iconOnly /><button onClick={exit} title={text('Progress will be cleared', '进度将被清除')}>{text('Exit tutorial', '退出教程')}</button></div>
      </header>
      <main className="stage"><SceneBoundary><Suspense fallback={<p role="status">{text('Loading board…', '正在加载棋盘…')}</p>}>
        <TableScene view={view} names={{ ...names, alice: text('You', '你') }} guidedView={guidedView} />
      </Suspense></SceneBoundary></main>
      <section className="panel tutorial-instruction" aria-live="polite" aria-atomic="true">
        <h2 ref={titleRef} tabIndex={-1}>{stage === 'finished' ? text('Ready to play!', '可以开始游戏了！') : words.title[lang]}</h2>
        <p>{instruction}</p>
        {stage === 'action' && <button className="tutorial-focus" onClick={() => setFocusId(id => id + 1)}>{text('Focus target', '聚焦目标')}</button>}
      </section>
      <footer className="hand">
        <ResourceDock player={me} points={snapshot.view.viewer.earnedVp} />
        <div className="tutorial-actions" role="group" aria-label={text('Tutorial actions', '教程操作')}>
          {targets.map(target => <button key={targetKey(target)} onClick={() => select(target)} aria-pressed={board.selected !== null && targetKey(board.selected) === targetKey(target)}>{label(target)}</button>)}
          {canConfirm && <button onClick={() => { if (draftAction) submit(draftAction); else submit(step.action); }}>{step.action.kind === 'produce' ? options[0]?.label : text('Confirm', '确认')}</button>}
          {stage === 'result' && <button onClick={next}>{text('Continue', '继续')}</button>}
          {stage === 'finished' && <button onClick={exit}>{text('Back to lobby', '返回大厅')}</button>}
        </div>
      </footer>
    </div>
  </SceneInteractionProvider>;
}
