import { applyCommand, createGame, createId, getLegalCommands, RULESET } from '@vibe-rico/game-engine';
import type { GameCommand, GameState, PlayerId } from '@vibe-rico/game-engine';
import { decide, freshMemory } from '../../src/bots/decide.js';
import type { BotMemory } from '../../src/bots/decide.js';
import type { ChoiceQuestion, DecisionClient } from '../../src/bots/jev.js';
import type { AcceptedCommand } from '../../src/rooms/store.js';

type Answer = (id: string, q: ChoiceQuestion) => Record<string, number> | undefined;
/** Answers each Choice with `answer`'s probabilities, by default skewed to the first option; records every request. */
export class FakeClient implements DecisionClient {
  calls = 0;
  readonly questions: Record<string, ChoiceQuestion>[] = [];
  readonly states: unknown[] = [];
  constructor(private readonly answer: Answer = () => undefined) {}
  async ask(state: unknown, questions: Record<string, ChoiceQuestion>) {
    this.calls++;
    this.questions.push(questions);
    this.states.push(state);
    return Object.fromEntries(Object.entries(questions).map(([id, q]) => {
      const keys = Object.keys(q.criteria);
      const probabilities = this.answer(id, q) ?? Object.fromEntries(keys.map((k, i) => [k, i === 0 ? 0.5 : 0.5 / Math.max(1, keys.length - 1)]));
      const choice = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]![0];
      return [id, { choice, confidence: 0.5, probabilities }];
    }));
  }
}

export async function playBots(players: number, client: DecisionClient | null, seed = 11) {
  const seats = Array.from({ length: players }, (_, i) => createId('player', `bot${i}`)) as PlayerId[];
  const created = createGame({ rulesetId: RULESET.id, gameId: createId('game', 'bots'), seatOrder: seats, governorPlayerId: seats[0]!, seed });
  if (!created.ok) throw Error(created.error.message);
  let state: GameState = created.state;
  const history: AcceptedCommand[] = [];
  const memory = new Map<string, BotMemory>();
  const names = Object.fromEntries(seats.map((id, i) => [id, `Bot ${i}`]));
  let maxCalls = 0, moves = 0;
  while (state.phase.kind !== 'game-over' && moves < 2000) {
    const me = seats.find(id => getLegalCommands(state, id).length > 0)!;
    const decision = await decide({ state, history, me, names, memory: memory.get(me) ?? freshMemory(), client });
    if (!decision) throw Error(`no decision in ${state.phase.kind}`);
    memory.set(me, decision.memory);
    maxCalls = Math.max(maxCalls, decision.calls);
    const result = applyCommand(state, { ...decision.action, actorId: me } as GameCommand);
    if (!result.ok) throw Error(`${state.phase.kind} ${decision.trace.key}: ${result.error.message}`);
    history.push({ playerId: me, commandId: `c${moves}`, expectedRevision: state.revision, action: decision.action as AcceptedCommand['action'], acceptedRevision: result.state.revision, events: result.events });
    state = result.state;
    moves++;
  }
  return { state, moves, maxCalls, memory };
}

