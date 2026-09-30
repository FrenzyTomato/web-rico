import { assertGameState } from './invariants/assertGameState.js';
import type { CommandByPhase } from './model/commands.js';
import type { RuleError } from './model/events.js';
import type { DecisionKind, DecisionPhase } from './model/phase.js';
import type { GameState } from './model/state.js';

/** Single phase/command routing table, checked against the domain contract. */
export const COMMANDS: { readonly [K in DecisionKind]: readonly CommandByPhase[K]['kind'][] } = {
  'role-selection':['choose-role'], 'planter-before':['use-hacienda'],
  'planter-choice':['plant'], 'planter-worker':['use-hospital'],
  'recruiter-advantage':['recruit-worker'], 'recruiter-placement':['allocate-workers'],
  'builder-choice':['build'], 'craftsman-production':['produce'],
  'craftsman-bonus':['take-production-bonus'], 'trader-choice':['trade'],
  'captain-loading':['load','decline-wharf'], 'captain-retention':['retain'],
  adventurer:['take-adventurer-coin'],
};
export const ERRORS = {
  gameOver:{code:'GAME_OVER',ruleId:'ENDGAME-002',message:'The game is over.'},
  wrongPhase:{code:'WRONG_PHASE',ruleId:'ROLE-001',message:'This command is not allowed in this phase.'},
  wrongActor:{code:'WRONG_ACTOR',ruleId:'ROLE-001',message:'This player is not the decision-maker.'},
  unknown:{code:'UNKNOWN_COMMAND',ruleId:'ROLE-001',message:'Unknown command or missing command identity.'},
  unsupported:{code:'UNSUPPORTED_PHASE',ruleId:'ROLE-001',message:'This phase is not implemented yet.'},
} as const satisfies Record<string,RuleError>;

/** Engine bugs/corrupt snapshots throw; invalid player decisions return stable errors. */
export function inspectDecision(state: GameState, actorId: unknown):
  { readonly phase: DecisionPhase } | { readonly error: RuleError } {
  assertGameState(state);
  if(state.phase.kind==='game-over') return {error:ERRORS.gameOver};
  if(!('actorId' in state.phase)) return {error:ERRORS.wrongPhase};
  if(actorId!==state.phase.actorId) return {error:ERRORS.wrongActor};
  return {phase:state.phase};
}

/** getLegalCommands cannot represent unsupported behavior as a legal empty turn. */
export class DispatchError extends Error {
  readonly error: RuleError;
  constructor(error: RuleError) { super(error.message); this.name='DispatchError'; this.error={...error}; }
}
