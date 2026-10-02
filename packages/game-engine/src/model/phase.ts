import type { PlayerId, TileId } from './ids.js';
import type { FinalScoreBreakdown, Good, Role } from './state.js';

export interface RoleTurn {
  readonly actorId: PlayerId;
  readonly roleChooserId: PlayerId;
  /** Clockwise offset from the chooser; wraps during repeated Captain visits. */
  readonly actorIndex: number;
}
interface PlantingTurn extends RoleTurn { readonly acquiredTileIds: readonly TileId[] }
interface ProductionTurn extends RoleTurn { readonly chooserProducedTypes: readonly Good[] }

export type DecisionPhase =
  | { readonly kind: 'role-selection'; readonly actorId: PlayerId }
  | (RoleTurn & { readonly kind: 'planter-before' })
  | (PlantingTurn & { readonly kind: 'planter-choice' })
  | (PlantingTurn & { readonly kind: 'planter-worker' })
  | (RoleTurn & { readonly kind: 'recruiter-advantage' })
  | (RoleTurn & { readonly kind: 'recruiter-placement'; readonly confirmedPlayerIds?: readonly PlayerId[] })
  | (RoleTurn & { readonly kind: 'builder-choice' })
  | (ProductionTurn & { readonly kind: 'craftsman-production' })
  | (ProductionTurn & { readonly kind: 'craftsman-bonus' })
  | (RoleTurn & { readonly kind: 'trader-choice' })
  | (RoleTurn & {
      readonly kind: 'captain-loading';
      readonly captainBonusUsed: boolean;
      readonly consecutiveNoLoads: number;
    })
  | (RoleTurn & { readonly kind: 'captain-retention' })
  | (RoleTurn & { readonly kind: 'adventurer' });

export type AutomaticPhase =
  | { readonly kind: 'recruiter-distribution'; readonly roleChooserId: PlayerId }
  | { readonly kind: 'phase-completion'; readonly role: Role; readonly roleChooserId: PlayerId }
  | { readonly kind: 'round-completion' };

export type GamePhase = DecisionPhase | AutomaticPhase
  | { readonly kind: 'game-over'; readonly scores: readonly FinalScoreBreakdown[] };
export type DecisionKind = DecisionPhase['kind'];
