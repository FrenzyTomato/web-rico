import { randomUUID } from 'node:crypto';
import { getLegalCommands } from '@vibe-rico/game-engine';
import type { GameEvent, GameState, PlayerId } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { GameplayRequest } from '@vibe-rico/protocol';
import type { RoomQueues } from '../commands/queue.js';
import { submitCommand } from '../commands/submit.js';
import type { RoomStore } from '../rooms/store.js';
import { decide, freshMemory } from './decide.js';
import type { BotMemory } from './decide.js';
import type { DecisionClient } from './jev.js';

/** Pause before each bot move: long enough to read the move notice clients show, short enough not to drag. */
export const BOT_PAUSE_MS = 1800;

export interface BotRunnerOptions {
  /** Null plays on the code value alone (no JEV_API_KEY). */
  readonly client: DecisionClient | null;
  /** Pause before each bot move so people can follow it. */
  readonly delayMs?: number;
  readonly log?: (entry: Record<string, unknown>) => void;
}

/**
 * Plays bot seats (docs/BOT_STRATEGY.md). `kick` after every commit, start and restart; each bot with a decision
 * submits through submitCommand like any seat, so validation, deduplication and broadcast are unchanged.
 */
export class BotRunner {
  readonly #memory = new Map<string, BotMemory>();
  readonly #pending = new Set<string>();
  readonly #failures = new Map<string, number>();
  readonly #timers = new Set<ReturnType<typeof setTimeout>>();
  #stopped = false;

  constructor(private readonly store: RoomStore, private readonly queues: RoomQueues,
    private readonly onCommitted: (roomId: string, state: GameState, events: readonly GameEvent[]) => Promise<void>,
    private readonly options: BotRunnerOptions) {}

  kick(roomId: string): void { void this.#schedule(roomId).catch(() => {}); }

  stop(): void {
    this.#stopped = true;
    for (const timer of this.#timers) clearTimeout(timer);
    this.#timers.clear();
  }

  async #schedule(roomId: string) {
    if (this.#stopped) return;
    const game = (await this.store.get(roomId))?.room;
    if (!game?.game) return;
    const state = game.game.state;
    if (state.phase.kind === 'game-over') {
      for (const s of game.seats) this.#memory.delete(`${roomId}:${s.playerId}`);
      return;
    }
    for (const seat of game.seats) {
      const key = `${roomId}:${seat.playerId}`;
      if (!seat.bot || this.#pending.has(key) || getLegalCommands(state, seat.playerId).length === 0) continue;
      this.#pending.add(key);
      const timer = setTimeout(() => {
        this.#timers.delete(timer);
        void this.#play(roomId, seat.playerId).catch(e => this.#log({ roomId, bot: seat.playerId, error: String(e) }))
          .finally(() => { this.#pending.delete(key); this.kick(roomId); });
      }, this.options.delayMs ?? BOT_PAUSE_MS);
      this.#timers.add(timer);
    }
  }

  async #play(roomId: string, botId: PlayerId) {
    const room = (await this.store.get(roomId))?.room;
    const game = room?.game;
    if (!room || !game || this.#stopped) return;
    const state = game.state;
    const tried = `${roomId}:${botId}:${state.revision}`;
    const failures = this.#failures.get(tried) ?? 0;
    // A move rejected twice at one revision is not retried until the game moves on.
    if (failures >= 2) return;
    const key = `${roomId}:${botId}`;
    const names = Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]));
    const input = { state, history: game.commands, me: botId, names, memory: this.#memory.get(key) ?? freshMemory() };
    // After a rejection the code value alone decides, so a misjudged option is not offered again.
    const decision = await decide({ ...input, client: failures ? null : this.options.client });
    if (!decision) return;
    this.#memory.set(key, decision.memory);
    const result = await submitCommand(this.store, this.queues, roomId, botId,
      { protocolVersion: PROTOCOL_VERSION, roomId, commandId: randomUUID(), expectedRevision: state.revision, action: decision.action as GameplayRequest['action'] },
      () => !this.#stopped, (s, events) => this.onCommitted(roomId, s, events));
    this.#log({ roomId, bot: names[botId], revision: state.revision, move: decision.trace.key, calls: decision.calls,
      strategy: decision.memory.strategy, ...(decision.trace.fallback ? { fallback: decision.trace.fallback } : {}),
      ...('code' in result ? { rejected: result.code } : {}) });
    if ('code' in result && result.code !== 'STALE_REVISION') this.#failures.set(tried, failures + 1);
    else this.#failures.delete(tried);
  }

  #log(entry: Record<string, unknown>) { this.options.log?.({ bot: true, ...entry }); }
}
