import { useState } from 'react';
import { GameShell } from '../layout/GameShell.js';
import { createGameStore } from '../state/gameStore.js';
import { demoSnapshot } from './snapshot.js';

export function createDemoStore() {
  const store = createGameStore({ send: async () => { throw new Error('Demo has no transport'); } });
  store.getState().receive(structuredClone(demoSnapshot));
  // No session and no commands, even if a control accidentally attempts a submit.
  store.setState({ submit: () => null, sessionReady: () => {} });
  return store;
}

export function Demo() {
  const [store] = useState(createDemoStore);
  return <GameShell store={store} roomId="demo" demo lobbyHref="/?lobby=1" room={{
    roomCode: 'DEMO', hostPlayerId: 'alice', started: true,
    seats: [{ playerId: 'alice', displayName: 'Alice' }, { playerId: 'bruno', displayName: 'Bruno' }, { playerId: 'chen', displayName: 'Chen' }],
  }} />;
}
