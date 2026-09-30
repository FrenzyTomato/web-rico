import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { Resumed, RoomReply, SeatGranted } from '@vibe-rico/protocol';

/** Same-origin connection; in development Vite proxies /socket.io to the server (vite.config.ts). */
export const createSocket = (): Socket => io();

/** The part of a socket the lobby uses, so tests can supply a fake. */
export type LobbySocket = Pick<Socket, 'emitWithAck' | 'on' | 'off' | 'connected' | 'timeout'>;

type RoomAction =
  | { kind: 'create-room'; displayName: string }
  | { kind: 'join-room'; roomCode: string; displayName: string }
  | { kind: 'start-game'; roomId: string };
export function sendRoom(socket: LobbySocket, action: Extract<RoomAction, { kind: 'create-room' | 'join-room' }>): Promise<RoomReply<SeatGranted>>;
export function sendRoom(socket: LobbySocket, action: Extract<RoomAction, { kind: 'start-game' }>): Promise<RoomReply<null>>;
export function sendRoom(socket: LobbySocket, action: RoomAction) {
  return socket.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });
}
export const sendResume = (socket: LobbySocket, roomId: string, token: string): Promise<RoomReply<Resumed>> =>
  socket.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId, token });

/** The seat credential survives a refresh so the player can resume (ARCHITECTURE "Goals"). */
const SEAT_KEY = 'vibe-rico.seat';
export interface SavedSeat { readonly roomId: string; readonly roomCode: string; readonly playerId: string; readonly token: string }
export const loadSeat = (): SavedSeat | null => JSON.parse(localStorage.getItem(SEAT_KEY) ?? 'null') as SavedSeat | null;
export const saveSeat = (seat: SavedSeat) => localStorage.setItem(SEAT_KEY, JSON.stringify(seat));
export const clearSeat = () => localStorage.removeItem(SEAT_KEY);
