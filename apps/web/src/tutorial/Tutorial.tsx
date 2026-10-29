import { useEffect, useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useLanguage } from '../i18n/language.js';
import { GameShell } from '../layout/GameShell.js';
import type { ShellGuide } from '../layout/GameShell.js';
import { createGameStore } from '../state/gameStore.js';
import { allowedTargets, allowsTarget, createTutorialController, sameAction } from './controller.js';
import { describeMove, introPages, islandCheck, playerName, tutorialCopy } from './copy.js';
import { RoleDiagramView } from './RoleDiagrams.js';
import { explainPages } from './rolePages.js';
import type { GuidePage } from './rolePages.js';
import { RoundDiagram } from './RoundDiagram.js';
import { learner } from './scenario.js';

type Controller = ReturnType<typeof createTutorialController>;
type TutorialState = ReturnType<Controller['getState']>;
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
      chronicle: s.history, pending: {}, rejection: null,
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
  const language = useLanguage();
  const pages = useMemo(() => explainPages(state, language), [state, language]);
  const paused = pages !== null;
  useEffect(() => {
    controller.getState().reset();
    const hide = () => controller.getState().dispose();
    const restore = (event: PageTransitionEvent) => { if (event.persisted) controller.getState().reset(); };
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', restore);
    return () => { hide(); window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', restore); };
  }, [controller]);
  // Opponents play on their own; each timer is tied to the move it was scheduled for.
  useEffect(() => {
    if ((stage !== 'opponent' && stage !== 'opponent-result') || paused) return;
    const timer = setTimeout(() => {
      if (stage === 'opponent') controller.getState().opponentMove(generation, index);
      else controller.getState().next(generation, index);
    }, stage === 'opponent' ? PREVIEW_MS : RESULT_MS);
    return () => clearTimeout(timer);
  }, [controller, generation, index, stage, paused]);
  const guide = useGuide(state, controller, language, pages);
  const text = (en: string, zh: string) => language === 'zh' ? zh : en;
  if (!guide) return null;
  return <GameShell store={store} roomId="tutorial" lobbyHref={LOBBY} guide={guide} room={{
    roomCode: 'TUTORIAL', hostPlayerId: 'alice', started: true,
    seats: [{ playerId: 'alice', displayName: text('You', '你') }, { playerId: 'bruno', displayName: 'Bruno' }, { playerId: 'chen', displayName: 'Chen' }],
  }} />;
}

function useGuide(state: TutorialState, controller: Controller, language: 'en' | 'zh', explain: GuidePage[] | null): ShellGuide | null {
  const { generation, index, stage, step, snapshot, previous } = state;
  const text = (en: string, zh: string) => language === 'zh' ? zh : en;
  const copy = step && snapshot ? tutorialCopy(step, snapshot.view, language) : null;
  const actorId = step?.command.actorId;
  // Opening pages come before the first move of each fresh game.
  const [introAt, setIntroAt] = useState({ generation, page: 0 });
  const pages = introPages(language);
  const introPage = introAt.generation === generation ? introAt.page : 0;
  const page = stage === 'intro' ? pages[Math.min(introPage, pages.length - 1)]! : null;
  // Which explanation page is open; a new move starts again at the first.
  const [explainAt, setExplainAt] = useState({ key: '', page: 0 });
  const moveKey = `${generation}:${index}`;
  const explainPage = explain ? Math.min(explainAt.key === moveKey ? explainAt.page : 0, explain.length - 1) : 0;
  const explaining = explain?.[explainPage];
  // The camera follows the page or move being taught, including an opponent's own island; an explanation page may
  // point at what it describes (the trading house, the ships).
  const [camera, cameraPlayer] = page ? [page.camera, page.mine ? learner : undefined]
    : explaining?.camera ? [explaining.camera, undefined]
    : stage === 'result' && previous?.step.action.kind !== 'choose-role' ? ['mine' as const, learner] : [copy?.camera, copy?.camera === 'mine' ? actorId : undefined];
  const guidedView = useMemo(() => camera && ({ id: generation * 100000 + index * 100 + introPage * 10 + explainPage, view: camera, ...(cameraPlayer ? { playerId: cameraPlayer } : {}) }),
    [generation, index, introPage, explainPage, camera, cameraPlayer]);
  if (!step || !snapshot || !copy || !guidedView || stage === 'disposed') return null;
  if (page) return {
    allowAction: () => false, allowTarget: () => false, guidedView, hintResetKey: `${generation}:intro:${introPage}`,
    coach: <aside className="model-tooltip tutorial-coach" role="status" aria-live="polite" aria-atomic="true"
      data-tutorial-stage="intro" data-tutorial-index={`intro-${introPage}`} data-revision={snapshot.revision}>
      <small>{text('Tutorial', '教程')} · {introPage + 1}/{pages.length}</small>
      <strong>{page.title}</strong>
      {page.diagram && <RoundDiagram text={text} />}
      {page.body.map(p => <p key={p}>{p}</p>)}
      <div className="tutorial-coach-actions">
        <button onClick={() => introPage === pages.length - 1 ? controller.getState().begin(generation) : setIntroAt({ generation, page: introPage + 1 })}>{introPage === pages.length - 1 ? text('Start', '开始') : text('Next', '下一步')}</button>
      </div>
    </aside>,
  };
  const learnerTurn = stage === 'action';
  const finished = stage === 'finished';
  // A plant, build or role pick was already explained on its own pause page.
  const checked = previous?.step.command.actorId === learner && ['plant', 'build', 'choose-role'].includes(previous.step.action.kind);
  const lastMove = previous && (stage === 'result' || !checked) ? describeMove(previous, snapshot.view, language) : '';
  const advance = () => {
    if (explain && explainPage < explain.length - 1) setExplainAt({ key: moveKey, page: explainPage + 1 });
    else if (stage === 'opponent') controller.getState().opponentMove(generation, index);
    else controller.getState().next(generation, index);
  };
  const round = text(`Round ${snapshot.view.roundNumber}`, `第 ${snapshot.view.roundNumber} 轮`);
  const heading = explaining ? explaining.title : finished ? text('Ready to play!', '可以开始游戏了！')
    : stage === 'result' ? text('Check your island', '查看你的岛屿')
    : stage === 'opponent-result' ? text(`${playerName(previous!.step.command.actorId, text)} moved`, `${playerName(previous!.step.command.actorId, text)}已行动`)
    : learnerTurn ? `${text('Your turn', '轮到你')} · ${copy.title}` : `${text(`${copy.actor}'s turn`, `${copy.actor}的回合`)} · ${copy.title}`;
  const body = finished
    ? text('That covers every role: estates, buildings, workers, production, trading and shipping. Each round, players take turns choosing roles until everyone has one. The game ends when points, workers or island space run out.', '你已体验所有角色：田园、建筑、工人、生产、交易和运货。每轮玩家轮流选择角色，直到每人都选过。分数、工人或岛上空间耗尽时游戏结束。')
    : stage === 'result' ? islandCheck(previous!, snapshot.view, language)
    : stage === 'opponent' ? copy.preview : stage === 'opponent-result' ? null : copy.todo;
  return {
    allowAction: action => learnerTurn && sameAction(action, step.action),
    allowTarget: (target, draft, good) => learnerTurn && allowsTarget(step, draft, good, target),
    highlight: stage === 'opponent' ? allowedTargets(step, null, step.action.kind === 'load' ? step.action.shipment.good : step.action.kind === 'trade' ? step.action.sale?.good ?? null : null)[0] : undefined,
    guidedView,
    hintResetKey: `${generation}:${index}`,
    coach: <aside className="model-tooltip tutorial-coach" role="status" aria-live="polite" aria-atomic="true"
      data-tutorial-stage={stage} data-tutorial-step={step.action.kind} data-tutorial-actor={actorId} data-tutorial-index={index} data-revision={snapshot.revision}>
      <small>{text('Tutorial', '教程')} · {round}{explain && explain.length > 1 ? ` · ${explainPage + 1}/${explain.length}` : ''}</small>
      <strong>{heading}</strong>
      {explaining ? <>
        {explaining.diagram && <RoleDiagramView diagram={explaining.diagram} text={text} />}
        {explaining.paragraphs.map(p => typeof p === 'string' ? <p key={p}>{p}</p>
          : <p key={p.text} className={p.tone === 'privilege' ? 'tutorial-coach-privilege' : 'tutorial-coach-next'}>{p.text}</p>)}
      </> : <>
        {lastMove && (stage !== 'opponent' || previous?.step.command.actorId === learner) && <p className="tutorial-coach-last">{lastMove}</p>}
        {body && <p>{body}</p>}
      </>}
      {(stage === 'opponent' || stage === 'opponent-result' || stage === 'result' || finished) && <div className="tutorial-coach-actions">
        {!finished && <button onClick={advance}>{explain && explainPage === explain.length - 1 ? text('Got it', '明白了') : text('Next', '下一步')}</button>}
        {finished && <a className="back-to-lobby" href={LOBBY}>{text('Back to lobby', '返回大厅')}</a>}
      </div>}
    </aside>,
  };
}
