import { createStore } from 'zustand/vanilla';
import type { CommandAccepted, CommandRejected, GameplayRequest, PlayerBroadcast, PlayerEvent } from '@vibe-rico/protocol';
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
  /** Recent filtered events for the chronicle, newest last (at most CHRONICLE_SIZE). */
  readonly chronicle: readonly PlayerEvent[];
  receive(broadcast: PlayerBroadcast): void;
  /** The server holds this connection's session again: allow sends and retry every pending command. */
  sessionReady(): void;
  disconnected(): void;
  /** Returns the commandId, or null when sending is disabled (no session or no snapshot yet). */
  submit(roomId: string, action: GameplayRequest['action']): string | null;
}

export const CHRONICLE_SIZE = 50;
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
      receive: broadcast => {
        if (get().latest && broadcast.revision <= get().latest!.revision) return;
        set(s => ({ latest: broadcast, chronicle: [...s.chronicle, ...broadcast.events].slice(-CHRONICLE_SIZE) }));
      },
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
