import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useLanguage } from '../i18n/language.js';
import { GameShell } from '../layout/GameShell.js';
import type { ShellGuide } from '../layout/GameShell.js';
import { CHRONICLE_SIZE, createGameStore } from '../state/gameStore.js';
import { allowedTargets, allowsTarget, createTutorialController, sameAction } from './controller.js';
import { describeMove, playerName, tutorialCopy } from './copy.js';
import { learner } from './scenario.js';

type Controller = ReturnType<typeof createTutorialController>;
const LOBBY = '/?lobby=1';
/** Time to read an opponent's upcoming move, then its result. */
const PREVIEW_MS = 1600, RESULT_MS = 3600;

/** The normal game store, fed by the local simulation instead of a socket. Only the learner's guided move is offered. */
function createTutorialStore(controller: Controller) {
  const store = createGameStore({ send: async () => { throw new Error('Tutorial has no transport'); } });
  const sync = () => {
    const s = controller.getState();
    store.setState({
      latest: s.snapshot && { ...s.snapshot, legalActions: s.stage === 'action' ? s.snapshot.legalActions : [] },
      chronicle: s.history.slice(-CHRONICLE_SIZE), pending: {}, rejection: null,
    });
  };
  sync();
  controller.subscribe(sync);
  store.setState({
    connected: true, sessionReady: () => {}, disconnected: () => {}, receive: () => {},
    submit: (_roomId, action) => {
      const s = controller.getState();
      if (s.step && s.snapshot && s.submit(s.generation, s.step.id, s.snapshot.revision, action)) return `tutorial-${s.index}`;
      store.setState({ rejection: { commandId: null, code: 'ILLEGAL_COMMAND' } });
      return null;
    },
  });
  return store;
}

export function Tutorial() {
  const [controller] = useState(createTutorialController);
  const [store] = useState(() => createTutorialStore(controller));
  const state = useStore(controller);
  const { generation, index, stage } = state;
  useEffect(() => {
    controller.getState().reset();
    const hide = () => controller.getState().dispose();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) controller.getState().reset(); };
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', restore);
    return () => { hide(); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', restore); };
  }, [controller]);
  // Opponents play on their own; each timer is tied to the move it was scheduled for.
  useEffect(() => {
    if (stage !== 'opponent' && stage !== 'opponent-result') return;
    const timer = setTimeout(() => {
      if (stage === 'opponent') controller.getState().opponentMove(generation, index);
      else controller.getState().next(generation, index);
    }, stage === 'opponent' ? PREVIEW_MS : RESULT_MS);
    return () => clearTimeout(timer);
  }, [controller, generation, index, stage]);
  const language = useLanguage();
  const guide = useGuide(state, controller, language);
  const text = (en: string, zh: string) => language === 'zh' ? zh : en;
  if (!guide) return null;
  return <GameShell store={store} roomId="tutorial" lobbyHref={LOBBY} guide={guide} room={{
    roomCode: 'TUTORIAL', hostPlayerId: 'alice', started: true,
    seats: [{ playerId: 'alice', displayName: text('You', '你') }, { playerId: 'bruno', displayName: 'Bruno' }, { playerId: 'chen', displayName: 'Chen' }],
  }} />;
}

function useGuide(state: ReturnType<Controller['getState']>, controller: Controller, language: 'en' | 'zh'): ShellGuide | null {
  const { generation, index, stage, step, snapshot, previous } = state;
  const text = (en: string, zh: string) => language === 'zh' ? zh : en;
  const copy = step && snapshot ? tutorialCopy(step, snapshot.view, language) : null;
  const actorId = step?.command.actorId;
  // The camera follows the move being taught, including an opponent's own island.
  const guidedView = useMemo(() => copy && ({ id: generation * 1000 + index, view: copy.camera, ...(copy.camera === 'mine' ? { playerId: actorId! } : {}) }),
    [generation, index, copy?.camera, actorId]);
  if (!step || !snapshot || !copy || !guidedView || stage === 'disposed') return null;
  const learnerTurn = stage === 'action';
  const finished = stage === 'finished';
  const lastMove = previous ? describeMove(previous, snapshot.view, language) : '';
  const advance = () => {
    if (stage === 'opponent') controller.getState().opponentMove(generation, index);
    else controller.getState().next(generation, index);
  };
  const round = text(`Round ${snapshot.view.roundNumber}`, `第 ${snapshot.view.roundNumber} 轮`);
  const heading = finished ? text('Ready to play!', '可以开始游戏了！')
    : stage === 'opponent-result' ? text(`${playerName(previous!.step.command.actorId, text)} moved`, `${playerName(previous!.step.command.actorId, text)}已行动`)
    : learnerTurn ? `${text('Your turn', '轮到你')} · ${copy.title}` : `${text(`${copy.actor}’s turn`, `${copy.actor}的回合`)} · ${copy.title}`;
  const body = finished
    ? text('That covers every role: estates, buildings, workers, production, trading and shipping. Each round, players take turns choosing roles until everyone has one. The game ends when points, workers or island space run out.', '你已体验所有角色：田园、建筑、工人、生产、交易和运货。每轮玩家轮流选择角色，直到每人都选过。分数、工人或岛上空间耗尽时游戏结束。')
    : stage === 'opponent' ? copy.preview : stage === 'opponent-result' ? null : copy.todo;
  return {
    allowAction: action => learnerTurn && sameAction(action, step.action),
    allowTarget: (target, draft, good) => learnerTurn && allowsTarget(step, draft, good, target),
    highlight: stage === 'opponent' ? allowedTargets(step, null, step.action.kind === 'load' ? step.action.shipment.good : step.action.kind === 'trade' ? step.action.sale?.good ?? null : null)[0] : undefined,
    guidedView,
    hintResetKey: `${generation}:${index}`,
    coach: <aside className="model-tooltip tutorial-coach" role="status" aria-live="polite" aria-atomic="true"
      data-tutorial-stage={stage} data-tutorial-step={step.action.kind} data-tutorial-actor={actorId} data-tutorial-index={index} data-revision={snapshot.revision}>
      <small>{text('Tutorial', '教程')} · {round}</small>
      <strong>{heading}</strong>
      {lastMove && (stage !== 'opponent' || previous?.step.command.actorId === learner) && <p className="tutorial-coach-last">{lastMove}</p>}
      {body && <p>{body}</p>}
      {(stage === 'opponent' || stage === 'opponent-result') && <button onClick={advance}>{text('Next', '下一步')}</button>}
      {finished && <a className="back-to-lobby" href={LOBBY}>{text('Back to lobby', '返回大厅')}</a>}
    </aside>,
  };
}
