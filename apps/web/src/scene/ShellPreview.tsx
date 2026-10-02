import { useState } from 'react';
import { applyCommand, getLegalCommands } from '@vibe-rico/game-engine';
import type { GameState } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { createGameStore } from '../state/gameStore.js';
import { GameShell } from '../layout/GameShell.js';

/** Development-only full UI sandbox. A fixed seat, isolated from real rooms and network traffic. */
export function ShellPreview({ initial }: { initial: GameState }) {
  const [store] = useState(() => {
    let state = initial;
    const actor = 'actorId' in state.phase ? state.phase.actorId : state.seatOrder[0]!;
    const snapshot = (): PlayerBroadcast => ({ protocolVersion: PROTOCOL_VERSION, revision: state.revision, events: [], legalActions: getLegalCommands(state, actor),
      view: { ...state, viewer: { playerId: actor, earnedVp: state.players.find(p => p.playerId === actor)!.earnedVp }, players: state.players.map(({ earnedVp: _, ...p }) => p) } });
    const game = createGameStore({ send: async request => {
      const result = applyCommand(state, { ...request.action, actorId: actor });
      if (!result.ok) return { commandId: request.commandId, code: 'ILLEGAL_COMMAND', ruleId: result.error.ruleId };
      state = result.state;
      game.getState().receive(snapshot());
      return { commandId: request.commandId, acceptedRevision: state.revision };
    } });
    game.getState().receive(snapshot()); game.getState().sessionReady(); return game;
  });
  return <GameShell lobbyHref="/?lobby=1" store={store} roomId="local-layout-preview" room={{ roomCode: 'PREVIEW', hostPlayerId: initial.seatOrder[0]!, started: true,
    seats: initial.seatOrder.map(playerId => ({ playerId, displayName: playerId })) }} />;
}
