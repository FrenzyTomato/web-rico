import type { PlayerId, TileId, BuildingId, RoleCardId, ShipId } from './ids.js';
import type { DecisionKind, DecisionPhase } from './phase.js';
import type { BuildingType, Good, Goods } from './state.js';

interface Actor { readonly actorId: PlayerId }
export interface WorkerAllocation {
  readonly countryside: readonly { readonly tileId: TileId; readonly occupied: boolean }[];
  readonly buildings: readonly { readonly buildingId: BuildingId; readonly occupiedSlots: number }[];
  readonly idleCount: number;
}
export type PlantingChoice =
  | { readonly kind: 'estate'; readonly tileId: TileId }
  | { readonly kind: 'quarry' }
  | { readonly kind: 'decline' };
export type Shipment =
  | { readonly kind: 'cargo'; readonly shipId: ShipId; readonly good: Good }
  | { readonly kind: 'personal'; readonly good: Good };

/** Internal commands: actorId is attached by the trusted server, never trusted from the wire. */
export interface CommandByPhase {
  readonly 'role-selection': Actor & { readonly kind: 'choose-role'; readonly roleCardId: RoleCardId };
  readonly 'planter-before': Actor & { readonly kind: 'use-hacienda'; readonly accept: boolean };
  readonly 'planter-choice': Actor & { readonly kind: 'plant'; readonly choice: PlantingChoice };
  readonly 'planter-worker': Actor & { readonly kind: 'use-hospital'; readonly tileId: TileId | null };
  readonly 'recruiter-advantage': Actor & { readonly kind: 'recruit-worker'; readonly accept: boolean };
  readonly 'recruiter-placement': Actor & { readonly kind: 'allocate-workers'; readonly allocation: WorkerAllocation };
  readonly 'builder-choice': Actor & { readonly kind: 'build'; readonly purchase: {
    readonly buildingTypeId: BuildingType; readonly useAdvantage: boolean; readonly useSchool: boolean;
  } | null };
  readonly 'craftsman-production': Actor & { readonly kind: 'produce'; readonly production:
    | { readonly accept: false }
    | { readonly accept: true; readonly useFactory: boolean } };
  readonly 'craftsman-bonus': Actor & { readonly kind: 'take-production-bonus'; readonly good: Good | null };
  readonly 'trader-choice': Actor & { readonly kind: 'trade'; readonly sale: {
    readonly good: Good; readonly useAdvantage: boolean;
    readonly useSmallMarket: boolean; readonly useLargeMarket: boolean;
  } | null };
  readonly 'captain-loading': Actor & (
    | { readonly kind: 'load'; readonly shipment: Shipment; readonly useHarbor: boolean }
    // Valid only with no mandatory cargo load and an optional unused Wharf.
    | { readonly kind: 'decline-wharf' }
  );
  readonly 'captain-retention': Actor & { readonly kind: 'retain'; readonly retained: Goods;
    readonly warehouseTypes: readonly Good[] };
  readonly 'adventurer': Actor & { readonly kind: 'take-adventurer-coin'; readonly accept: boolean };
}
export type GameCommand = CommandByPhase[DecisionKind];
/** Preserves the phase/command relationship even after narrowing a union. */
export type DecisionSubmission = {
  [K in DecisionKind]: { readonly phase: Extract<DecisionPhase, { kind: K }>; readonly command: CommandByPhase[K] }
}[DecisionKind];

// Explicit available values, normally [false] or [false, true]. No implicit default.
export type EffectChoices = readonly boolean[];
export interface LegalOptionsByPhase {
  readonly 'role-selection': { readonly roleCardIds: readonly RoleCardId[] };
  readonly 'planter-before': { readonly accept: EffectChoices };
  readonly 'planter-choice': { readonly choices: readonly PlantingChoice[] };
  readonly 'planter-worker': { readonly tileIds: readonly (TileId | null)[] };
  readonly 'recruiter-advantage': { readonly accept: EffectChoices };
  readonly 'recruiter-placement': {
    readonly totalWorkers: number;
    readonly slots: readonly (
      | { readonly kind: 'countryside'; readonly instanceId: TileId; readonly capacity: 1 }
      | { readonly kind: 'building'; readonly instanceId: BuildingId; readonly capacity: number }
    )[];
    readonly idleOnlyWhenAllSlotsFilled: true;
  };
  readonly 'builder-choice': {
    readonly canDecline: true;
    readonly purchases: readonly { readonly buildingTypeId: BuildingType;
      readonly useAdvantage: boolean; readonly price: number; readonly schoolChoices: EffectChoices }[];
  };
  readonly 'craftsman-production': { readonly canDecline: true; readonly output: Goods; readonly factoryChoices: EffectChoices };
  readonly 'craftsman-bonus': { readonly goods: readonly (Good | null)[] };
  readonly 'trader-choice': {
    readonly canDecline: true;
    readonly sales: readonly { readonly good: Good; readonly useAdvantage: boolean;
      readonly useSmallMarket: boolean; readonly useLargeMarket: boolean; readonly price: number }[];
  };
  readonly 'captain-loading': {
    readonly loads: readonly { readonly shipment: Shipment; readonly quantity: number }[];
    readonly harborChoices: EffectChoices;
    readonly canDeclineWharf: boolean;
  };
  readonly 'captain-retention': {
    readonly available: Goods; readonly maxWarehouseTypes: 0 | 1 | 2 | 3; readonly extraSingleCrates: 1;
  };
  readonly 'adventurer': { readonly accept: EffectChoices };
}
export type LegalAction = {
  [K in DecisionKind]: Actor & { readonly phase: K } & LegalOptionsByPhase[K]
}[DecisionKind];
