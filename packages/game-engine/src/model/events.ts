import type { PlayerId, RoleCardId, ShipId } from './ids.js';
import type { GamePhase } from './phase.js';
import type { WorkerAllocation } from './commands.js';
import type { BuildingInstance, CountrysideTile, EndTrigger, FinalScoreBreakdown, GameState, Good, Role } from './state.js';

export type GoodsLocation =
  | { readonly kind: 'supply' | 'trading-house' }
  | { readonly kind: 'player' | 'personal-ship'; readonly playerId: PlayerId }
  | { readonly kind: 'cargo-ship'; readonly shipId: ShipId };

/** Canonical server-only events. PR-035/042 must project these before broadcasting. */
export type GameEvent = {
  readonly revision: number;
  readonly index: number;
} & (
  | { readonly kind: 'role-selected'; readonly playerId: PlayerId; readonly cardId: RoleCardId; readonly role: Role }
  | { readonly kind: 'coins-changed'; readonly playerId: PlayerId; readonly delta: number }
  | { readonly kind: 'goods-moved'; readonly good: Good; readonly quantity: number; readonly from: GoodsLocation; readonly to: GoodsLocation }
  | { readonly kind: 'tile-placed'; readonly playerId: PlayerId; readonly tile: CountrysideTile }
  | { readonly kind: 'building-built'; readonly playerId: PlayerId; readonly building: BuildingInstance }
  | { readonly kind: 'workers-received'; readonly playerId: PlayerId; readonly quantity: number; readonly source: 'supply' | 'register' }
  | { readonly kind: 'workers-allocated'; readonly playerId: PlayerId; readonly allocation: WorkerAllocation }
  | { readonly kind: 'vp-earned'; readonly playerId: PlayerId; readonly quantity: number; readonly overflow: number }
  | { readonly kind: 'end-triggered'; readonly trigger: EndTrigger }
  | { readonly kind: 'phase-changed'; readonly from: GamePhase['kind']; readonly to: GamePhase['kind'] }
  | { readonly kind: 'game-scored'; readonly scores: readonly FinalScoreBreakdown[] }
);
export interface RuleError {
  readonly code: 'WRONG_ACTOR' | 'WRONG_PHASE' | 'ILLEGAL_CHOICE' | 'GAME_OVER' | 'UNKNOWN_COMMAND' | 'UNSUPPORTED_PHASE' | 'INVALID_SETUP' | 'UNSUPPORTED_RULESET';
  readonly ruleId: string;
  readonly message: string;
}
export type GameResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly error: RuleError };
