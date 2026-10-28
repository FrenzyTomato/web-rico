import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { GameEvent, GameState, PlayerId } from '@vibe-rico/game-engine';
import { parseAuthRequest, parseGameplayRequest, parseResumeRequest, parseRoomRequest } from '@vibe-rico/protocol';
import type { CommandRejected, MyGame, Resumed, RoomReply, SeatGranted } from '@vibe-rico/protocol';
import { RoomQueues } from './commands/queue.js';
import { submitCommand } from './commands/submit.js';
import { InMemoryRoomStore } from './rooms/inMemoryStore.js';
import { RoomLifecycle } from './rooms/lifecycle.js';
import { LIMITS, RateLimiter } from './rooms/limits.js';
import { Lobby } from './rooms/lobby.js';
import type { LobbyRandom } from './rooms/lobby.js';
import type { RoomStore } from './rooms/store.js';
import { exportRoom, importRoom } from './debug/scenarios.js';
import { Sessions } from './sessions/reconnect.js';
import { recoverRooms } from './storage/recoverRoom.js';
import { broadcast, broadcastFor, roomState } from './rooms/broadcast.js';
import { BotRunner } from './bots/runner.js';
import { rewindRole } from './rooms/rewind.js';
import { eventsForPlayer } from './projection/playerEvents.js';
import type { Accounts, AccountUser } from './accounts/supabase.js';
import type { BotRunnerOptions } from './bots/runner.js';

/** Largest accepted Socket.IO message; bigger messages close the connection (PROTOCOL.md step 1, size). */
export const MAX_MESSAGE_BYTES = 16 * 1024;
/** Dev tools only: a full-game replay import is tens of KiB. */
export const DEV_MAX_MESSAGE_BYTES = 1024 * 1024;

interface Session { readonly roomId: string; readonly playerId: PlayerId; readonly generation: number }
type Ack<T> = (reply: T) => void;

/**
 * `devTools` enables full-state scenario tools; only for a controlled local environment (off by default).
 * `random` replaces crypto randomness for deterministic browser tests (apps/web/e2e/server.mjs).
 * `store` defaults to the in-memory store; PostgreSQL is wired in main.ts (PR-058).
 * `webRoot` serves the built web client from the same origin as Socket.IO (production, PR-061).
 * `bots` plays bot seats; without a decision client they play on the code value alone (docs/BOT_STRATEGY.md).
 * `accounts` enables optional sign-in (docs/ACCOUNTS_PLAN.md); without it every player is a guest.
 */
export function createApp({ devTools = false, random, store = new InMemoryRoomStore(), webRoot, allowedOrigins = [], bots: botOptions = { client: null }, accounts }: {
  devTools?: boolean; random?: LobbyRandom; store?: RoomStore; webRoot?: string; allowedOrigins?: string[]; bots?: BotRunnerOptions; accounts?: Accounts | undefined;
} = {}) {
  const app = Fastify();
  app.get('/health', async () => ({ status: 'ok' }));
  if (webRoot) void app.register(fastifyStatic, { root: webRoot });
  const io = new Server(app.server, { cors: { origin: allowedOrigins }, maxHttpBufferSize: devTools ? DEV_MAX_MESSAGE_BYTES : MAX_MESSAGE_BYTES });
  const queues = new RoomQueues();
  const lobby = new Lobby(store, random), lifecycle = new RoomLifecycle(store, queues), sessions = new Sessions(store);
  const sweeper = setInterval(() => void lifecycle.sweep(), LIMITS.sweepIntervalMs);
  sweeper.unref();
  /** Every commit is broadcast, then bots that now have a decision are scheduled. */
  const committed = async (roomId: string, state: GameState, events: readonly GameEvent[]) => {
    await broadcast(io, roomId, state, events);
    bots.kick(roomId);
  };
  const bots = new BotRunner(store, queues, committed, botOptions);
  app.addHook('preClose', async () => { clearInterval(sweeper); bots.stop(); io.disconnectSockets(true); });
  const limiter = new RateLimiter(LIMITS.eventsPerWindow, LIMITS.windowMs);

  const sessionOf = (socket: Socket) => socket.data.session as Session | undefined;
  /** The connection's signed-in account while its access token is unexpired. */
  const userOf = (socket: Socket) => {
    const account = socket.data.account as AccountUser | undefined;
    return account && account.expiresAt > Date.now() ? account.userId : undefined;
  };
  /** A seat's snapshot and full filtered timeline, sent to the connection that just took it (resume or rejoin). */
  const sendSnapshot = async (socket: Socket, roomId: string, playerId: PlayerId) => {
    const game = (await store.get(roomId))?.room.game;
    if (!game) return null;
    socket.emit('state', broadcastFor(game.state, [], playerId));
    // The seat's full timeline, filtered like every broadcast (others' VP stays hidden).
    socket.emit('history', { revision: game.state.revision, events: game.commands.flatMap(c => eventsForPlayer(c.events, playerId)) });
    return game.state.revision;
  };
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

  /** Store failures must not crash the process (unhandled rejections): answer STORE_UNAVAILABLE instead. */
  const guarded = (handler: (payload: unknown, ack: unknown) => Promise<unknown> | unknown) => (payload: unknown, ack: unknown) => {
    void Promise.resolve().then(() => handler(payload, ack)).catch(() => {
      if (typeof ack === 'function') ack({ ok: false, code: 'STORE_UNAVAILABLE' });
    });
  };
  io.on('connection', socket => {
    // Over the rate limit closes the connection, like an oversized message.
    socket.use((_packet, next) => { if (limiter.allow(socket.id, Date.now())) next(); else socket.disconnect(true); });
    socket.on('disconnect', () => {
      limiter.forget(socket.id);
      const s = sessionOf(socket);
      if (s && sessions.release(s.roomId, s.playerId, socket.id)) lifecycle.disconnected(s.roomId, s.playerId);
    });

    socket.on('resume', guarded((payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const reply = ack as Ack<RoomReply<Resumed>>;
      const parsed = parseResumeRequest(payload);
      if (!parsed.ok) return reply({ ok: false, code: parsed.code });
      const { roomId, token } = parsed.value;
      // Subscribe and read the snapshot revision in one queued task, so no commit falls between them.
      return queues.run(roomId, async () => {
        const playerId = await sessions.authenticate(roomId, token);
        if (!playerId) return reply({ ok: false, code: 'UNAUTHORIZED' });
        attach(socket, roomId, playerId);
        // Snapshot recovery: the seat's current projection, sent before any later broadcast.
        const revision = await sendSnapshot(socket, roomId, playerId);
        reply({ ok: true, value: { playerId, revision } });
        await announce(roomId);
      });
    }));

    // Sign-in state for this connection: a verified Supabase access token (refreshed tokens are sent again), or null.
    socket.on('auth', guarded(async (payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const reply = ack as Ack<RoomReply<{ signedIn: boolean }>>;
      const parsed = parseAuthRequest(payload);
      if (!parsed.ok) return reply({ ok: false, code: parsed.code });
      const account = parsed.value.accessToken && accounts ? await accounts.verify(parsed.value.accessToken) : null;
      if (parsed.value.accessToken && !account) return reply({ ok: false, code: 'UNAUTHORIZED' });
      socket.data.account = account ?? undefined;
      reply({ ok: true, value: { signedIn: Boolean(account) } });
    }));

    socket.on('room', guarded(async (payload: unknown, ack: unknown) => {
      if (typeof ack !== 'function') return;
      const parsed = parseRoomRequest(payload);
      if (!parsed.ok) return (ack as Ack<RoomReply<null>>)({ ok: false, code: parsed.code });
      const action = parsed.value.action;
      if (action.kind === 'my-games' || action.kind === 'resume-account' || action.kind === 'delete-account') {
        const userId = userOf(socket);
        if (!userId) return (ack as Ack<RoomReply<null>>)({ ok: false, code: 'UNAUTHORIZED' });
        if (action.kind === 'my-games') {
          const games: MyGame[] = [];
          for (const roomId of await store.roomIdsForUser(userId)) {
            const room = (await store.get(roomId))?.room;
            const mine = room?.seats.find(s => s.userId === userId);
            if (!room || !mine) continue;
            games.push({ roomId, roomCode: room.roomCode, players: room.seats.map(s => s.displayName), you: mine.displayName,
              status: !room.game ? 'lobby' : room.game.state.phase.kind === 'game-over' ? 'ended' : 'playing', round: room.game?.state.roundNumber ?? null });
          }
          return (ack as Ack<RoomReply<MyGame[]>>)({ ok: true, value: games });
        }
        if (action.kind === 'resume-account') {
          const reply = ack as Ack<RoomReply<SeatGranted>>;
          return queues.run(action.roomId, async () => {
            const rotated = await lobby.rotateAccountSeat(action.roomId, userId);
            if (!rotated.ok) return reply(rotated);
            attach(socket, action.roomId, rotated.value.playerId);
            await sendSnapshot(socket, action.roomId, rotated.value.playerId);
            reply({ ok: true, value: { roomId: action.roomId, roomCode: rotated.value.roomCode, playerId: rotated.value.playerId, token: rotated.value.token } });
            await announce(action.roomId);
          });
        }
        // delete-account: seats become guest seats, then the Supabase user is removed.
        for (const roomId of await store.roomIdsForUser(userId)) await queues.run(roomId, () => lobby.unlinkSeat(roomId, userId));
        await accounts!.deleteUser(userId);
        socket.data.account = undefined;
        return (ack as Ack<RoomReply<null>>)({ ok: true, value: null });
      }
      if (action.kind === 'create-room' || action.kind === 'join-room') {
        const reply = ack as Ack<RoomReply<SeatGranted>>;
        const userId = userOf(socket);
        const granted = action.kind === 'create-room'
          ? await lobby.createRoom(action.displayName, userId)
          : await lobby.joinRoom(action.roomCode, action.displayName, userId).then(r => r.ok ? { ok: true as const, value: { ...r.value, roomCode: action.roomCode } } : r);
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
      if (action.kind === 'claim-seat') {
        const userId = userOf(socket);
        reply(userId ? await queues.run(s.roomId, () => lobby.claimSeat(s.roomId, s.playerId, userId)) : { ok: false, code: 'UNAUTHORIZED' });
      } else if (action.kind === 'start-game') {
        reply(await queues.run(s.roomId, async () => {
          const started = await lobby.startGame(s.roomId, s.playerId);
          const game = started.ok ? (await store.get(s.roomId))?.room.game : undefined;
          if (game) { await announce(s.roomId); await committed(s.roomId, game.state, []); }
          return started;
        }));
      } else if (action.kind === 'add-bot' || action.kind === 'fill-bots' || action.kind === 'remove-bot') {
        reply(await queues.run(s.roomId, async () => {
          const edited = action.kind === 'add-bot' ? await lobby.addBot(s.roomId, s.playerId)
            : action.kind === 'fill-bots' ? await lobby.fillBots(s.roomId, s.playerId, action.seats)
            : await lobby.removeBot(s.roomId, s.playerId, action.playerId);
          if (edited.ok) await announce(s.roomId);
          return edited;
        }));
      } else if (action.kind === 'rewind-role') {
        reply(await queues.run(s.roomId, async () => {
          const rewound = await rewindRole(store, s.roomId, s.playerId);
          if (!rewound.ok) return rewound;
          await broadcast(io, s.roomId, rewound.value, [], true);
          bots.kick(s.roomId);
          return { ok: true as const, value: null };
        }));
      } else if (action.kind === 'close-room') {
        reply(await lifecycle.close(s.roomId, s.playerId));
      } else {
        const left = await lifecycle.leave(s.roomId, s.playerId);
        if (left.ok) { await socket.leave(s.roomId); socket.data.session = undefined; await announce(s.roomId); }
        reply(left);
      }
    }));

    if (devTools) {
      // Seated players only, for their own room; payload is `{ roomId }` or `{ roomId, replay }`.
      const devSession = (payload: unknown) => {
        const s = sessionOf(socket);
        const roomId = (payload as { roomId?: unknown } | null)?.roomId;
        return s && s.roomId === roomId && sessions.isCurrent(s.roomId, s.playerId, s.generation) ? s : undefined;
      };
      socket.on('debug-export', guarded(async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const s = devSession(payload);
        ack(s ? await exportRoom(store, s.roomId) : { ok: false, code: 'UNAUTHORIZED' });
      }));
      socket.on('debug-import', guarded(async (payload: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        const s = devSession(payload);
        if (!s) return ack({ ok: false, code: 'UNAUTHORIZED' });
        ack(await queues.run(s.roomId, async () => {
          const result = await importRoom(store, s.roomId, (payload as { replay?: unknown }).replay);
          const game = result.ok ? (await store.get(s.roomId))?.room.game : undefined;
          if (game) await committed(s.roomId, game.state, []);
          return result;
        }));
      }));
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
        (state, events) => committed(s.roomId, state, events)));
    });
  });
  // Await before listening: rebuilds presence for stored rooms after a restart.
  // Bots resume any turn that was pending when the server stopped.
  const ready = recoverRooms(store, lifecycle).then(async count => {
    for (const roomId of await store.listRoomIds()) bots.kick(roomId);
    return count;
  });
  return { app, io, ready };
}
