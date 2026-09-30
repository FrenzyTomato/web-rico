import { describe, expect, it } from 'vitest';
import { applyCommand, assertGameState, createGame, deserializeGame, getLegalCommands, serializeGame } from '../../src/index.js';
import type { CreateGameInput, GameCommand, GameEvent, GameState } from '../../src/index.js';
import { createReplay, replay, serializeReplay } from '../../src/replay/replay.js';
import { expectLedgers, independentScores } from '../helpers/verify.js';
import * as three from './fixtures/full-game-3p.js';
import * as four from './fixtures/full-game-4p.js';
import * as five from './fixtures/full-game-5p.js';

// TS-REPLAY / PR-036. Each history starts at createGame and is a frozen literal command list;
// no resource is edited. Expected values are literals checked against an independent scorer.
// scores per seat: [earnedVp, baseBuildingVp, bonusVp, totalVp, tiebreak coins+goods, rank].
const GAMES = [
  { fixture: three, commands: 259, rounds: 22, trigger: 256, scores: [
    [18, 17, 6, 41, 4, 2], [23, 11, 0, 34, 0, 3], [36, 10, 0, 46, 2, 1]] },
  { fixture: four, commands: 340, rounds: 19, trigger: 335, scores: [
    [9, 16, 0, 25, 0, 4], [16, 13, 0, 29, 1, 3], [40, 6, 0, 46, 2, 2], [40, 9, 0, 49, 3, 1]] },
  { fixture: five, commands: 400, rounds: 15, trigger: 390, scores: [
    [3, 11, 0, 14, 0, 5], [25, 16, 0, 41, 3, 3], [19, 7, 0, 26, 2, 4], [42, 10, 0, 52, 1, 2], [51, 5, 0, 56, 2, 1]] },
].map(g => ({ ...g, n: g.fixture.input.seatOrder.length, input: g.fixture.input as unknown as CreateGameInput,
  history: g.fixture.commands as readonly GameCommand[] }));

function start(input: CreateGameInput): GameState {
  const created = createGame(input);
  if (!created.ok) throw Error(created.error.message);
  return created.state;
}

describe.each(GAMES)('TS-REPLAY: fixed $n-player history', ({ n, input, history, commands, rounds, trigger, scores }) => {
  it('accepts every command with invariants, recovery and independent ledgers at each step', () => {
    const initial = start(input);
    let state = initial;
    const vp = new Map<string, number>(), roles = new Set<string>();
    let overflow = 0;
    expectLedgers(state);
    for (const [index, command] of history.entries()) {
      const before = serializeGame(state);
      // Legal-action generation and validation agree: only the decision-maker has a descriptor.
      expect(state.seatOrder.filter(id => getLegalCommands(state, id).length > 0), `command ${index}`).toEqual([command.actorId]);
      const result = applyCommand(state, command);
      if (!result.ok) throw Error(`command ${index} rejected: ${result.error.code} ${result.error.message}`);
      expect(serializeGame(state)).toBe(before);
      expect(result.state.revision).toBe(state.revision + 1);
      expect(result.events.map(e => [e.index, e.revision])).toEqual(result.events.map((_, i) => [i, result.state.revision]));
      assertGameState(result.state);
      expectLedgers(result.state);
      // Snapshot recovery before every command reproduces the identical transition.
      expect(applyCommand(deserializeGame(before), command)).toEqual(result);
      for (const e of result.events) {
        if (e.kind === 'vp-earned') { vp.set(e.playerId, (vp.get(e.playerId) ?? 0) + e.quantity); overflow += e.overflow; }
        if (e.kind === 'role-selected') roles.add(e.role);
      }
      state = result.state;
    }
    expect(history).toHaveLength(commands);
    expect(state.revision).toBe(initial.revision + commands);
    expect(state.roundNumber).toBe(rounds);
    expect(state.endTriggers).toEqual([{ reason: 'vp-exhausted', role: 'captain', triggeringRevision: trigger, completion: 'phase-completion' }]);
    expect([...roles].sort()).toEqual(['builder', 'captain', 'craftsman', 'planter', 'recruiter', 'trader', ...(n > 3 ? ['adventurer'] : [])].sort());
    if (state.phase.kind !== 'game-over') throw Error(`history ended in ${state.phase.kind}`);
    // Scoring: engine result = independent recomputation = frozen literals; earned VP matches the event ledger.
    expect(state.phase.scores).toEqual(independentScores(state));
    expect(state.phase.scores.map(s => [s.earnedVp, s.baseBuildingVp, Object.values(s.bonuses).reduce((a, b) => a + b, 0),
      s.totalVp, s.tieBreakCoinsAndGoods, s.rank])).toEqual(scores);
    for (const p of state.players) expect(vp.get(p.playerId) ?? 0).toBe(p.earnedVp);
    expect(overflow).toBe(state.supply.vpOverflow);
    for (const id of state.seatOrder) expect(getLegalCommands(state, id)).toEqual([]);
  });

  it('replays identically from the record and after snapshot recovery at every round start', () => {
    const initial = start(input);
    const json = serializeReplay(createReplay(initial, history, input.seed));
    const full = replay(JSON.parse(json));
    if (!full.ok) throw Error(JSON.stringify(full.failure));
    expect(full.state.phase.kind).toBe('game-over');
    expect(full.events).toHaveLength(commands);
    expect(replay(JSON.parse(json))).toEqual(full);
    let state = initial, checkpoints = 0;
    const events: (readonly GameEvent[])[] = [];
    for (const [index, command] of history.entries()) {
      if (state.phase.kind === 'role-selection' && state.roleSelectionIndex === 0) {
        const recovered = replay(JSON.parse(serializeReplay(createReplay(deserializeGame(serializeGame(state)), history.slice(index), null))));
        expect(recovered).toMatchObject({ ok: true, state: full.state, events: full.events.slice(index) });
        checkpoints++;
      }
      const result = applyCommand(state, command);
      if (!result.ok) throw Error(`command ${index} rejected`);
      events.push(result.events); state = result.state;
    }
    expect(checkpoints).toBe(rounds);
    expect(full).toEqual({ ok: true, initialState: initial, state, events });
  });
});
