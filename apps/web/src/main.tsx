import './fonts/source-han-sans/font.css';
import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { GameShell } from './layout/GameShell.js';
import { ScenarioTools } from './debug/ScenarioTools.js';
import { Lobby } from './lobby/Lobby.js';
import { bindStore, socketTransport } from './network/commands.js';
import { createSocket, lobbyLink } from './network/socket.js';
import { createGameStore } from './state/gameStore.js';

const Demo = lazy(() => import('./demo/Demo.js').then(m => ({ default: m.Demo })));
const Tutorial = lazy(() => import('./tutorial/Tutorial.js').then(m => ({ default: m.Tutorial })));

function liveApp() {
  const socket = createSocket();
  const gameStore = createGameStore(socketTransport(socket));
  bindStore(socket, gameStore);
  const onSession = () => gameStore.getState().sessionReady();
  return <Lobby socket={socket} onSession={onSession} game={(seat, room) => (
    <>
      <GameShell store={gameStore} roomId={seat.roomId} room={room} lobbyHref={lobbyLink()} />
      {import.meta.env.DEV && <ScenarioTools socket={socket} roomId={seat.roomId} />}
    </>
  )} />;
}

// Demo visits never create a socket or attempt to resume an existing seat.
const isDemo = new URLSearchParams(location.search).get('demo') === '1';
const isTutorial = new URLSearchParams(location.search).get('tutorial') === '1';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isTutorial ? <Suspense fallback={null}><Tutorial /></Suspense> : isDemo ? <Suspense fallback={null}><Demo /></Suspense> : liveApp()}
  </StrictMode>,
);
