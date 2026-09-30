import { describe, expect, it } from 'vitest';
import { applyCommand, createGame, createId, deserializeGame, getLegalCommands, serializeGame } from '../src/index.js';
import type { CreateGameInput, GameCommand, GameState } from '../src/index.js';
import { createReplay, replay, serializeReplay, REPLAY_FORMAT_VERSION } from '../src/replay/replay.js';
import { startCli, runCliLine } from '../src/cli.js';

const input: CreateGameInput = {
  rulesetId: 'puerto-rico-1897-special-edition-base-en', gameId: createId('game', 'replay'),
  seatOrder: ['a', 'b', 'c'].map(p => createId('player', p)), governorPlayerId: createId('player', 'a'), seed: 42,
};
function initial(): GameState {
  const result = createGame(input);
  if (!result.ok) throw Error(result.error.message);
  return result.state;
}
function cli() {
  const { session, output } = startCli(input);
  if (!session) throw Error(output);
  return { session, output };
}
function actor(state: GameState) {
  if (!('actorId' in state.phase)) throw Error(`no decision in ${state.phase.kind}`);
  return state.phase.actorId;
}
// Independently chosen legal history: Planter chosen, every seat takes the first market estate,
// then Builder chosen and all three seats decline to build.
function history(start: GameState): GameCommand[] {
  const commands: GameCommand[] = [];
  let state = start;
  const push = (command: GameCommand) => {
    const result = applyCommand(state, command);
    if (!result.ok) throw Error(`${command.kind}: ${result.error.message}`);
    commands.push(command); state = result.state;
  };
  const card = (kind: string) => state.roleCards.find(c => c.kind === kind && c.selectedBy === null)!.instanceId;
  push({ kind: 'choose-role', actorId: actor(state), roleCardId: card('planter') });
  for (let i = 0; i < 3; i++) push({ kind: 'plant', actorId: actor(state), choice: { kind: 'estate', tileId: state.estateMarket[0]!.instanceId } });
  push({ kind: 'choose-role', actorId: actor(state), roleCardId: card('builder') });
  for (let i = 0; i < 3; i++) push({ kind: 'build', actorId: actor(state), purchase: null });
  return commands;
}

describe('TS-REPLAY: replay records', () => {
  it('reproduces the final state and every accepted revision from the initial snapshot plus history', () => {
    const start = initial();
    const commands = history(start);
    const expectedEvents = [];
    let state = start;
    for (const command of commands) {
      const result = applyCommand(state, command);
      if (!result.ok) throw Error(result.error.message);
      expectedEvents.push(result.events); state = result.state;
    }
    const record = createReplay(start, commands, input.seed);
    const json = serializeReplay(record);
    const before = serializeGame(start);
    const replayed = replay(JSON.parse(json));
    expect(replayed).toEqual({ ok: true, initialState: start, state, events: expectedEvents });
    expect(state.revision).toBe(start.revision + commands.length);
    // Snapshot recovery: a record rebuilt from the restored snapshot serializes identically and replays identically.
    expect(serializeReplay(createReplay(deserializeGame(serializeGame(start)), commands, 42))).toBe(json);
    expect(replay(JSON.parse(json))).toEqual(replayed);
    expect(serializeGame(start)).toBe(before);
    expect(JSON.parse(json)).toMatchObject({ formatVersion: REPLAY_FORMAT_VERSION, seed: 42,
      engineVersion: start.engineVersion, rulesetId: start.rulesetId, rulesetVersion: start.rulesetVersion, sourceHash: start.sourceHash });
  });

  it('identifies the zero-based index of the first rejected command', () => {
    const start = initial();
    const commands = history(start);
    // Index 2: the Planter chooser repeats a turn that now belongs to the next seat.
    const bad = [...commands.slice(0, 2), { ...commands[1]! }, ...commands.slice(2)];
    const result = replay(JSON.parse(serializeReplay(createReplay(start, bad, null))));
    expect(result).toMatchObject({ ok: false, failure: { kind: 'rejected-command', index: 2, command: bad[2],
      error: { code: 'WRONG_ACTOR' } } });
    const unknown = replay(createReplay(start, [commands[0]!, { kind: 'teleport', actorId: actor(start) } as unknown as GameCommand], null));
    expect(unknown).toMatchObject({ ok: false, failure: { kind: 'rejected-command', index: 1, error: { code: 'UNKNOWN_COMMAND' } } });
  });

  it.each([
    ['formatVersion', '$.formatVersion'], ['engineVersion', '$.engineVersion'], ['rulesetId', '$.rulesetId'],
    ['rulesetVersion', '$.rulesetVersion'], ['sourceHash', '$.sourceHash'],
  ])('fails explicitly on incompatible %s', (field, path) => {
    const record = JSON.parse(serializeReplay(createReplay(initial(), [], 42)));
    record[field] = '9.9.9';
    expect(replay(record)).toEqual({ ok: false, failure: { kind: 'incompatible-version', path } });
  });

  it('fails explicitly on an incompatible embedded snapshot or RNG version', () => {
    const record = JSON.parse(serializeReplay(createReplay(initial(), [], 42)));
    record.initialState.engineVersion = '9.9.9';
    expect(replay(record)).toEqual({ ok: false, failure: { kind: 'incompatible-version', path: '$.initialState.engineVersion' } });
    const rng = JSON.parse(serializeReplay(createReplay(initial(), [], 42)));
    rng.initialState.rng.version = '2';
    expect(replay(rng)).toEqual({ ok: false, failure: { kind: 'incompatible-version', path: '$.initialState.rng' } });
  });

  it('rejects malformed records and snapshots without applying commands', () => {
    const good = JSON.parse(serializeReplay(createReplay(initial(), [], 42)));
    expect(replay(null)).toEqual({ ok: false, failure: { kind: 'invalid-record', path: '$' } });
    expect(replay({ ...good, commands: {} })).toEqual({ ok: false, failure: { kind: 'invalid-record', path: '$.commands' } });
    expect(replay({ ...good, seed: -1 })).toEqual({ ok: false, failure: { kind: 'invalid-record', path: '$.seed' } });
    expect(replay({ ...good, extra: 1 })).toEqual({ ok: false, failure: { kind: 'invalid-record', path: '$.extra' } });
    const broken = { ...good, initialState: { ...good.initialState, revision: -1 } };
    expect(replay(broken)).toEqual({ ok: false, failure: { kind: 'invalid-snapshot', path: '$.initialState.revision' } });
    const inconsistent = JSON.parse(JSON.stringify(good));
    inconsistent.initialState.players[0].goods.corn += 1;
    expect(replay(inconsistent)).toMatchObject({ ok: false, failure: { kind: 'invalid-snapshot', path: '$.initialState' } });
  });
});

describe('headless CLI', () => {
  it('creates a seeded game and prints the state summary and legal choices', () => {
    const { session, output } = cli();
    expect(session.state).toEqual(initial());
    expect(output).toContain('game replay revision 0 round 1 phase role-selection actor a');
    expect(output).toContain(JSON.stringify(getLegalCommands(session.state, createId('player', 'a'))[0]));
    expect(startCli({ ...input, seatOrder: [] }).output).toBe('error INVALID_SETUP SETUP-001: Setup requires 3, 4, or 5 players.');
  });

  it('reads commands, fills the current actor, reports rejections by index, and records only accepted history', () => {
    let { session } = cli();
    const card = session.state.roleCards.find(c => c.kind === 'planter')!.instanceId;
    const rejected = runCliLine(session, '{"kind":"plant","choice":{"kind":"quarry"}}');
    expect(rejected.output).toBe('rejected command 0: WRONG_PHASE ROLE-001: This command is not allowed in this phase.');
    expect(rejected.session).toBe(session);
    expect(runCliLine(session, 'not json').output).toBe('error: expected a JSON command object or one of: state, legal, history, load <replay-json>, help');
    const accepted = runCliLine(session, JSON.stringify({ kind: 'choose-role', roleCardId: card }));
    session = accepted.session;
    expect(accepted.output).toMatch(/^accepted command 0 revision 1 events \d+\n/);
    expect(accepted.output).toContain('"kind":"role-selected"');
    expect(accepted.output).toContain('phase planter-choice actor a');
    expect(session.commands).toEqual([{ kind: 'choose-role', actorId: 'a', roleCardId: card }]);
    expect(runCliLine(session, 'state').output).toBe(serializeGame(session.state));
    expect(runCliLine(session, 'legal').output).toContain('"phase":"planter-choice"');
  });

  it('prints replayable history and loads it with failure-position diagnostics', () => {
    const start = initial();
    const commands = history(start);
    let { session } = cli();
    for (const command of commands) session = runCliLine(session, JSON.stringify(command)).session;
    const printed = runCliLine(session, 'history').output;
    expect(printed).toBe(serializeReplay(createReplay(start, commands, 42)));
    const loaded = runCliLine(cli().session, `load ${printed}`);
    expect(loaded.session.state).toEqual(session.state);
    expect(loaded.session.commands).toEqual(commands);
    expect(loaded.output).toContain(`replayed ${commands.length} commands`);
    const bad = JSON.parse(printed);
    bad.commands[3] = bad.commands[1];
    const failed = runCliLine(session, `load ${JSON.stringify(bad)}`);
    expect(failed.session).toBe(session);
    expect(failed.output).toMatch(/^replay failed at command 3: WRONG_ACTOR /);
    bad.engineVersion = '9.9.9';
    expect(runCliLine(session, `load ${JSON.stringify(bad)}`).output).toBe('replay failed: incompatible version at $.engineVersion');
    expect(runCliLine(session, 'load {').output).toBe('replay failed: invalid replay JSON');
    expect(deserializeGame(serializeGame(session.state))).toEqual(session.state);
  });
});
