import type { PlayerBroadcast } from '@vibe-rico/protocol';
import type { CommandTransport, GameStore } from '../state/gameStore.js';
import type { LobbySocket } from './socket.js';

export const socketTransport = (socket: LobbySocket): CommandTransport => ({ send: request => socket.emitWithAck('command', request) });

/** Feeds `state` broadcasts and disconnects into the store. Session readiness comes from the lobby (create/join/resume). */
export function bindStore(socket: LobbySocket, store: GameStore): () => void {
  const onState = (broadcast: PlayerBroadcast) => store.getState().receive(broadcast);
  const onDisconnect = () => store.getState().disconnected();
  socket.on('state', onState);
  socket.on('disconnect', onDisconnect);
  return () => { socket.off('state', onState); socket.off('disconnect', onDisconnect); };
}
