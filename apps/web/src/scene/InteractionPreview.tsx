import { PHASE, GOOD } from '../i18n/terms.js';
import { t, useLanguage, LanguageToggle } from '../i18n/language.js';
import { useMemo, useState } from 'react';
import { applyCommand, getLegalCommands } from '@vibe-rico/game-engine';
import type { GameState } from '@vibe-rico/game-engine';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { useBoardActions } from '../actions/useBoardActions.js';
import { describeOptions } from '../actions/options.js';
import { WorkerControls } from '../actions/WorkerControls.js';
import { ActionPanel } from '../actions/ActionPanel.js';
import { SceneInteractionProvider, targetKey } from './Selection.js';
import { TableScene } from './TableScene.js';

/** Local-only sandbox: validates clicks against the real engine, never contacts a room. */
export function InteractionPreview({ initial }: { initial: GameState }) {
  useLanguage();
  const [state, setState] = useState(initial);
  const [message, setMessage] = useState<'initial' | 'accepted' | 'rejected'>('initial');
  const actor = 'actorId' in state.phase ? state.phase.actorId : state.seatOrder[0]!;
  const latest: PlayerBroadcast = useMemo(() => ({ protocolVersion: '1', revision: state.revision, events: [], legalActions: getLegalCommands(state, actor),
    view: { ...state, viewer: { playerId: actor, earnedVp: state.players.find(p => p.playerId === actor)!.earnedVp }, players: state.players.map(({ earnedVp: _, ...p }) => p) },
  }), [state, actor]);
  const options = latest.legalActions[0] ? describeOptions(latest.legalActions[0], latest.view) ?? [] : [];
  const board = useBoardActions(latest, true, options, action => {
    const result = applyCommand(state, { ...action, actorId: actor });
    if (result.ok) { setState(result.state); setMessage('accepted'); }
    else setMessage('rejected');
  });
  const me = board.player ?? latest.view.players.find(p => p.playerId === actor)!;
  const view = { ...latest.view, players: latest.view.players.map(p => p.playerId === actor ? me : p) };
  return <div className="interaction-preview" style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
    <style>{'.interaction-preview > .scene { flex: 1; min-height: 0; height: auto; }'}</style>
    <div style={{ padding: 8 }}>
      <span role="status"><LanguageToggle />{message === 'initial' ? t('本地交互预览') : message === 'accepted' ? t('规则校验通过') : t('操作不符合当前规则，请重新选择')} · {PHASE[state.phase.kind]}{t(" · 池中工人 ")}{me.idleWorkerCount} · {board.draft?.holding ? t("已选工人") : board.good ? t("已选 {0}", [GOOD[board.good]]) : t("请选择棋子")}</span>
      <WorkerControls board={board} player={me} />
    </div>
    <SceneInteractionProvider value={{ actionable: board.actionable, select: board.select, pulse: null,
      selectedKey: board.selected ? targetKey(board.selected) : board.draft?.holding ? 'worker:pool:0' : null }}>
      <TableScene view={view} names={Object.fromEntries(view.seatOrder.map(id => [id, id]))} />
    </SceneInteractionProvider>
    <ActionPanel target={board.selected?.kind === 'crate' ? null : board.selected} options={board.panelOptions}
      clear={board.clear} submit={o => { const result = applyCommand(state, { ...o.action, actorId: actor }); if (result.ok) setState(result.state); }} />
  </div>;
}
