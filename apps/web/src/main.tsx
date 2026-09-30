import '@fontsource/cormorant-garamond/600.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GameShell } from './layout/GameShell.js';
import { ScenarioTools } from './debug/ScenarioTools.js';
import { Lobby } from './lobby/Lobby.js';
import { bindStore, socketTransport } from './network/commands.js';
import { createSocket } from './network/socket.js';
import { createGameStore } from './state/gameStore.js';

const socket = createSocket();
const gameStore = createGameStore(socketTransport(socket));
bindStore(socket, gameStore);
const onSession = () => gameStore.getState().sessionReady();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Lobby socket={socket} onSession={onSession} game={(seat, room) => (
      <>
        <GameShell store={gameStore} roomId={seat.roomId} room={room} />
        {import.meta.env.DEV && <ScenarioTools socket={socket} roomId={seat.roomId} />}
      </>
    )} />
  </StrictMode>,
);
