import { describe, expect, expectTypeOf, it } from 'vitest';
import { RULESET, createId } from '../src/index.js';
import type {
  GamePhase, GameCommand, CommandByPhase, DecisionSubmission,
  LegalAction, GameState, GameEvent, GameResult,
} from '../src/index.js';

const selection = { kind: 'role-selection', actorId: createId('player', 'a') } as const satisfies GamePhase;
const choose = { kind: 'choose-role', actorId: createId('player', 'a'), roleCardId: createId('role-card', 'role-1') } as const satisfies GameCommand;
const loading = {
  kind: 'captain-loading', actorId: createId('player', 'a'), roleChooserId: createId('player', 'a'), actorIndex: 0,
  captainBonusUsed: false, consecutiveNoLoads: 0,
} as const satisfies GamePhase;
const charter = {
  kind: 'load', actorId: createId('player', 'a'), shipment: { kind: 'personal', good: 'coffee' }, useHarbor: false,
} as const satisfies GameCommand;

// These must fail in the compiler, not just in runtime test transpilation.
// @ts-expect-error Captain progress is required.
const missingProgress: GamePhase = { kind: 'captain-loading', actorId: createId('player', 'a'), roleChooserId: createId('player', 'a') };
// @ts-expect-error Automatic phases have no actor decision.
const automaticActor: GamePhase = { kind: 'round-completion', actorId: createId('player', 'a') };
// @ts-expect-error No generic pass can bypass mandatory shipping.
const arbitraryPass: GameCommand = { kind: 'pass', actorId: createId('player', 'a') };
// @ts-expect-error Builder price is calculated, not client-supplied.
const suppliedPrice: GameCommand = { kind: 'build', actorId: createId('player', 'a'), purchase: null, price: 0 };
// @ts-expect-error A role choice is not a Captain command.
const mismatch: CommandByPhase['captain-loading'] = choose;
// @ts-expect-error Correlation holds even when both phase and command are unions.
const badSubmission: DecisionSubmission = { phase: loading, command: choose };
// @ts-expect-error Explicit School/advantage choices are required on a purchase.
const missingChoice: GameCommand = { kind: 'build', actorId: createId('player', 'a'), purchase: { buildingTypeId: 'school' } };
// @ts-expect-error Automatic/game-over phases cannot expose legal actions.
const automaticAction: LegalAction = { phase: 'game-over', actorId: createId('player', 'a') };

// Compile-time exhaustive switch: new phases must add an explicit case here.
function boundary(phase: GamePhase): 'decision' | 'automatic' | 'terminal' {
  switch (phase.kind) {
    case 'role-selection': case 'planter-before': case 'planter-choice': case 'planter-worker':
    case 'recruiter-advantage': case 'recruiter-placement': case 'builder-choice':
    case 'craftsman-production': case 'craftsman-bonus': case 'trader-choice':
    case 'captain-loading': case 'captain-retention': case 'adventurer': return 'decision';
    case 'recruiter-distribution': case 'phase-completion': case 'round-completion': return 'automatic';
    case 'game-over': return 'terminal';
    default: { const impossible: never = phase; return impossible; }
  }
}

describe('domain contract', () => {
  it('accepts phase-matched commands and bounded legal choices', () => {
    const input: DecisionSubmission = { phase: loading, command: charter };
    const options: LegalAction = {
      phase: 'role-selection', actorId: createId('player', 'a'), roleCardIds: [createId('role-card', 'role-1')],
    };
    expect(input.command.kind).toBe('load');
    expect(options.roleCardIds).toEqual(['role-1']);
    expectTypeOf<GameState['phase']>().toEqualTypeOf<GamePhase>();
    expectTypeOf<GameResult>().extract<{ ok: true }>().toHaveProperty('events').toEqualTypeOf<readonly GameEvent[]>();
    expectTypeOf<GameResult>().extract<{ ok: false }>().not.toHaveProperty('state');
  });
  it('distinguishes decision, automatic, and terminal boundaries', () => {
    expect(boundary(selection)).toBe('decision');
    expect(boundary({ kind: 'recruiter-distribution', roleChooserId: createId('player', 'a') })).toBe('automatic');
    expect(boundary({ kind: 'phase-completion', role: 'captain', roleChooserId: createId('player', 'a') })).toBe('automatic');
    expect(boundary({ kind: 'round-completion' })).toBe('automatic');
    expect(boundary({ kind: 'game-over', scores: [] })).toBe('terminal');
  });
  it('pins the reconciled ruleset and serializes representative decisions', () => {
    expect(RULESET.version).toBe('1.0.0');
    expect(RULESET.id).toBe('puerto-rico-1897-special-edition-base-en');
    expect(JSON.parse(JSON.stringify({ phase: loading, command: charter }))).toEqual({ phase: loading, command: charter });
  });
});
