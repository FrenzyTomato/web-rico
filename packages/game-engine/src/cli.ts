import { applyCommand } from './applyCommand.js';
import { getLegalCommands } from './getLegalCommands.js';
import type { GameCommand } from './model/commands.js';
import { serializeGame } from './model/serialization.js';
import type { GameState } from './model/state.js';
import { createReplay, replay, serializeReplay } from './replay/replay.js';
import type { ReplayFailure } from './replay/replay.js';
import { createGame } from './setup/createGame.js';
import type { CreateGameInput } from './setup/createGame.js';

/**
 * Headless developer controls. Pure line-in/text-out: the engine has no IO, so a later
 * host process owns stdin/stdout. Output is full private state for local debugging only.
 */
export interface CliSession {
  readonly seed: number | null;
  readonly initialState: GameState;
  readonly state: GameState;
  readonly commands: readonly GameCommand[];
}
export type CliResult = { readonly session: CliSession; readonly output: string };
const USAGE = 'expected a JSON command object or one of: state, legal, history, load <replay-json>, help';

function summary(state: GameState): string {
  const actor = 'actorId' in state.phase ? ` actor ${state.phase.actorId}` : '';
  const head = `game ${state.gameId} revision ${state.revision} round ${state.roundNumber} phase ${state.phase.kind}${actor}`;
  if (state.phase.kind === 'game-over') return [head, ...state.phase.scores.map(s => `score ${JSON.stringify(s)}`)].join('\n');
  return head;
}
function legal(state: GameState): string {
  return [summary(state), ...state.seatOrder.flatMap(id => getLegalCommands(state, id)).map(a => `legal ${JSON.stringify(a)}`)].join('\n');
}
function describeFailure(failure: ReplayFailure): string {
  if (failure.kind === 'rejected-command') {
    const { code, ruleId, message } = failure.error;
    return `replay failed at command ${failure.index}: ${code} ${ruleId}: ${message}`;
  }
  if (failure.kind === 'incompatible-version') return `replay failed: incompatible version at ${failure.path}`;
  return `replay failed: ${failure.kind === 'invalid-record' ? 'invalid record' : 'invalid snapshot'} at ${failure.path}`;
}

export function startCli(input: CreateGameInput): { readonly session: CliSession | null; readonly output: string } {
  const result = createGame(input);
  if (!result.ok) return { session: null, output: `error ${result.error.code} ${result.error.ruleId}: ${result.error.message}` };
  return { session: { seed: input.seed, initialState: result.state, state: result.state, commands: [] }, output: legal(result.state) };
}

/** Rejected or malformed lines return the unchanged session; only accepted commands are recorded. */
export function runCliLine(session: CliSession, line: string): CliResult {
  const text = line.trim();
  const same = (output: string): CliResult => ({ session, output });
  if (text === 'state') return same(serializeGame(session.state));
  if (text === 'legal') return same(legal(session.state));
  if (text === 'history') return same(serializeReplay(createReplay(session.initialState, session.commands, session.seed)));
  if (text === 'help') return same(USAGE);
  if (text.startsWith('load ')) {
    let record: unknown;
    try { record = JSON.parse(text.slice(5)); } catch { return same('replay failed: invalid replay JSON'); }
    const result = replay(record);
    if (!result.ok) return same(describeFailure(result.failure));
    // replay() has validated the record shape, versions and every command.
    const valid = record as { seed: number | null; commands: GameCommand[] };
    return { session: { seed: valid.seed, initialState: result.initialState, state: result.state, commands: valid.commands },
      output: `replayed ${valid.commands.length} commands\n${legal(result.state)}` };
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return same(`error: ${USAGE}`); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return same(`error: ${USAGE}`);
  const command = parsed as GameCommand;
  const index = session.commands.length;
  const result = applyCommand(session.state, command);
  if (!result.ok) return same(`rejected command ${index}: ${result.error.code} ${result.error.ruleId}: ${result.error.message}`);
  return {
    session: { ...session, state: result.state, commands: [...session.commands, command] },
    output: [`accepted command ${index} revision ${result.state.revision} events ${result.events.length}`,
      ...result.events.map(e => `event ${JSON.stringify(e)}`), legal(result.state)].join('\n'),
  };
}
