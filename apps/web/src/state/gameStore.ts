import { createStore } from 'zustand/vanilla';
import type { CommandAccepted, CommandRejected, GameplayRequest, PlayerBroadcast, PlayerEvent, PlayerHistory } from '@vibe-rico/protocol';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';

export interface CommandTransport { send(request: GameplayRequest): Promise<CommandAccepted | CommandRejected> }

export interface ClientState {
  /** Latest authoritative projection; views, legal actions and events come only from broadcasts. */
  readonly latest: PlayerBroadcast | null;
  /** True while the connection holds a live session (after create/join/resume, until disconnect). */
  readonly connected: boolean;
  /** Sent but unacknowledged requests, kept verbatim so retries reuse the original commandId. */
  readonly pending: Readonly<Record<string, GameplayRequest>>;
  readonly rejection: CommandRejected | null;
  /** Every filtered event of the game for the timeline, oldest first. */
  readonly chronicle: readonly PlayerEvent[];
  receive(broadcast: PlayerBroadcast): void;
  /** The full timeline from the server after a resume; later broadcasts append to it. */
  restoreHistory(history: PlayerHistory): void;
  /** The server holds this connection's session again: allow sends and retry every pending command. */
  sessionReady(): void;
  disconnected(): void;
  /** Returns the commandId, or null when sending is disabled (no session or no snapshot yet). */
  submit(roomId: string, action: GameplayRequest['action']): string | null;
}

export const createGameStore = (transport: CommandTransport, newId: () => string = () => crypto.randomUUID()) =>
  createStore<ClientState>()((set, get) => {
    const send = (request: GameplayRequest) => {
      transport.send(request).then(reply => set(s => {
        const { [request.commandId]: _, ...pending } = s.pending;
        // Acknowledgements only settle the request; state changes arrive by broadcast, in either order.
        return { pending, rejection: 'code' in reply ? reply : null };
      }), () => {
        // The connection dropped before the acknowledgement: keep it pending for the retry after resume.
      });
    };
    return {
      latest: null, connected: false, pending: {}, rejection: null, chronicle: [],
      // Old or duplicate snapshots never overwrite a newer one.
      // A rewound snapshot (a role choice taken back) replaces newer ones and drops their events.
      receive: broadcast => {
        if (get().latest && broadcast.revision <= get().latest!.revision && !broadcast.rewound) return;
        set(s => ({ latest: broadcast, chronicle: broadcast.rewound
          ? s.chronicle.filter(e => e.revision <= broadcast.revision)
          : [...s.chronicle, ...broadcast.events] }));
      },
      // Events newer than the history (a broadcast that raced it) are kept after it.
      restoreHistory: history => set(s => ({ chronicle: [...history.events, ...s.chronicle.filter(e => e.revision > history.revision)] })),
      sessionReady: () => { set({ connected: true }); for (const request of Object.values(get().pending)) send(request); },
      disconnected: () => set({ connected: false }),
      submit: (roomId, action) => {
        const { connected, latest } = get();
        if (!connected || !latest) return null;
        const request: GameplayRequest = { protocolVersion: PROTOCOL_VERSION, roomId, commandId: newId(), expectedRevision: latest.revision, action };
        set(s => ({ pending: { ...s.pending, [request.commandId]: request }, rejection: null }));
        send(request);
        return request.commandId;
      },
    };
  });
export type GameStore = ReturnType<typeof createGameStore>;
