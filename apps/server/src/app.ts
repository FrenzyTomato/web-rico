import Fastify from 'fastify';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { PlayerId } from '@vibe-rico/game-engine';
import { parseGameplayRequest, parseResumeRequest, parseRoomRequest } from '@vibe-rico/protocol';
import type { CommandRejected, Resumed, RoomReply, SeatGranted } from '@vibe-rico/protocol';
import { RoomQueues } from './commands/queue.js';
import { submitCommand } from './commands/submit.js';
import { InMemoryRoomStore } from './rooms/inMemoryStore.js';
import { RoomLifecycle } from './rooms/lifecycle.js';
import { LIMITS, RateLimiter } from './rooms/limits.js';
import { Lobby } from './rooms/lobby.js';
import type { LobbyRandom } from './rooms/lobby.js';
import { exportRoom, importRoom } from './debug/scenarios.js';
import { Sessions } from './sessions/reconnect.js';
import { broadcast, broadcastFor, roomState } from './rooms/broadcast.js';

/** Largest accepted Socket.IO message; bigger messages close the connection (PROTOCOL.md step 1, size). */
export const MAX_MESSAGE_BYTES = 16 * 1024;
/** Dev tools only: a full-game replay import is tens of KiB. */
export const DEV_MAX_MESSAGE_BYTES = 1024 * 1024;

interface Session { readonly roomId: string; readonly playerId: PlayerId; readonly generation: number }
type Ack<T> = (reply: T) => void;

/**
 * `devTools` enables full-state scenario tools; only for a controlled local environment (off by default).
 * `random` replaces crypto randomness for deterministic browser tests (apps/web/e2e/server.mjs).
 */
export function createApp({ devTools = false, random }: { devTools?: boolean; random?: LobbyRandom } = {}) {
  const app = Fastify();
  app.get('/health', async () => ({ status: 'ok' }));
  const io = new Server(app.server, { maxHttpBufferSize: devTools ? DEV_MAX_MESSAGE_BYTES : MAX_MESSAGE_BYTES });
  const store = new InMemoryRoomStore(), queues = new RoomQueues();
  const lobby = new Lobby(store, random), lifecycle = new RoomLifecycle(store, queues), sessions = new Sessions(store);
  const sweeper = setInterval(() => void lifecycle.sweep(), LIMITS.sweepIntervalMs);
  sweeper.unref();
  app.addHook('preClose', async () => { clearInterval(sweeper); io.disconnectSockets(true); });
  const limiter = new RateLimiter(LIMITS.eventsPerWindow, LIMITS.windowMs);

  const sessionOf = (socket: Socket) => socket.data.session as Session | undefined;
  const announce = async (roomId: string) => {
    const stored = await store.get(roomId);
    if (stored) io.to(roomId).emit('room-state', roomState(stored.room));
  };
  /** Binds the connection to a seat and its room channel (the subscription PR-042 broadcasts on). */
  const attach = (socket: Socket, roomId: string, playerId: PlayerId) => {
    const { generation, replacedSocketId } = sessions.take(roomId, playerId, socket.id);
    if (replacedSocketId !== undefined && replacedSocketId !== socket.id) {
      // The replaced connection leaves the channel, so broadcasts reach only current controllers.
      io.in(replacedSocketId).socketsLeave(roomId);
      io.to(replacedSocketId).emit('session-replaced');
    }
    socket.data.session = { roomId, playerId, generation } satisfies Session;
    void socket.join(roomId);
    lifecycle.connected(roomId, playerId);
  };

  io.on('connection', socket => {
    // Over the rate limit closes the connection, like an oversized message.
    socket.use((_packet, next) => { if (limiter.allow(socket.id, Date.now())) next(); else socket.disconnect(true); });
    socket.on('disconnect', () => {
      limiter.forget(socket.id);
      const s = sessionOf(socket);
      if (s && sessions.release(s.roomId, s.playerId, socket.id)) lifecycle.disconnected(s.roomId, s.playerId);
    });

    socket.on('resume', (payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const reply = ack as Ack<RoomReply<Resumed>>;
      const parsed = parseResumeRequest(payload);
      if (!parsed.ok) return reply({ ok: false, code: parsed.code });
      const { roomId, token } = parsed.value;
      // Subscribe and read the snapshot revision in one queued task, so no commit falls between them.
      void queues.run(roomId, async () => {
        const playerId = await sessions.authenticate(roomId, token);
        if (!playerId) return reply({ ok: false, code: 'UNAUTHORIZED' });
        attach(socket, roomId, playerId);
        const game = (await store.get(roomId))?.room.game;
        // Snapshot recovery: the seat's current projection, sent before any later broadcast.
        if (game) socket.emit('state', broadcastFor(game.state, [], playerId));
        reply({ ok: true, value: { playerId, revision: game?.state.revision ?? null } });
        await announce(roomId);
      });
    });

    socket.on('room', async (payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const parsed = parseRoomRequest(payload);
      if (!parsed.ok) return (ack as Ack<RoomReply<null>>)({ ok: false, code: parsed.code });
      const action = parsed.value.action;
      if (action.kind === 'create-room' || action.kind === 'join-room') {
        const reply = ack as Ack<RoomReply<SeatGranted>>;
        const granted = action.kind === 'create-room'
          ? await lobby.createRoom(action.displayName)
          : await lobby.joinRoom(action.roomCode, action.displayName).then(r => r.ok ? { ok: true as const, value: { ...r.value, roomCode: action.roomCode } } : r);
        if (!granted.ok) return reply(granted);
        attach(socket, granted.value.roomId, granted.value.playerId);
        const { roomId, roomCode, playerId, token } = granted.value;
        reply({ ok: true, value: { roomId, roomCode, playerId, token } });
        return announce(roomId);
      }
      const reply = ack as Ack<RoomReply<null>>;
      const s = sessionOf(socket);
      if (!s || s.roomId !== action.roomId) return reply({ ok: false, code: 'UNAUTHORIZED' });
      if (!sessions.isCurrent(s.roomId, s.playerId, s.generation)) return reply({ ok: false, code: 'STALE_SESSION' });
      if (action.kind === 'start-game') {
        reply(await queues.run(s.roomId, async () => {
          const started = await lobby.startGame(s.roomId, s.playerId);
          const game = started.ok ? (await store.get(s.roomId))?.room.game : undefined;
          if (game) { await announce(s.roomId); await broadcast(io, s.roomId, game.state, []); }
          return started;
        }));
      } else if (action.kind === 'close-room') {
        reply(await lifecycle.close(s.roomId, s.playerId));
      } else {
        const left = await lifecycle.leave(s.roomId, s.playerId);
        if (left.ok) { await socket.leave(s.roomId); socket.data.session = undefined; await announce(s.roomId); }
        reply(left);
      }
    });

    if (devTools) {
      // Seated players only, for their own room; payload is `{ roomId }` or `{ roomId, replay }`.
      const devSession = (payload: unknown) => {
        const s = sessionOf(socket);
        const roomId = (payload as { roomId?: unknown } | null)?.roomId;
        return s && s.roomId === roomId && sessions.isCurrent(s.roomId, s.playerId, s.generation) ? s : undefined;
      };
      socket.on('debug-export', async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const s = devSession(payload);
        ack(s ? await exportRoom(store, s.roomId) : { ok: false, code: 'UNAUTHORIZED' });
      });
      socket.on('debug-import', async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const s = devSession(payload);
        if (!s) return ack({ ok: false, code: 'UNAUTHORIZED' });
        ack(await queues.run(s.roomId, async () => {
          const result = await importRoom(store, s.roomId, (payload as { replay?: unknown }).replay);
          const game = result.ok ? (await store.get(s.roomId))?.room.game : undefined;
          if (game) await broadcast(io, s.roomId, game.state, []);
          return result;
        }));
      });
    }

    socket.on('command', async (payload: unknown, ack: unknown) => {
      // Replies travel on the acknowledgement; a request without one cannot be answered.
      if (typeof ack !== 'function') return;
      const reply = ack as Ack<Awaited<ReturnType<typeof submitCommand>>>;
      const parsed = parseGameplayRequest(payload);
      if (!parsed.ok) {
        const commandId = (payload as { commandId?: unknown } | null)?.commandId;
        return reply({ commandId: typeof commandId === 'string' ? commandId : null, code: parsed.code } satisfies CommandRejected);
      }
      // PROTOCOL.md step 1: roomId and playerId come from the session, never from the client.
      const s = sessionOf(socket);
      if (!s || s.roomId !== parsed.value.roomId) return reply({ commandId: parsed.value.commandId, code: 'UNAUTHORIZED' });
      reply(await submitCommand(store, queues, s.roomId, s.playerId, parsed.value, () => sessions.isCurrent(s.roomId, s.playerId, s.generation),
        (state, events) => broadcast(io, s.roomId, state, events)));
    });
  });
  return { app, io };
}
