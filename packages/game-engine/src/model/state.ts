import type { RngState } from '../rng/seeded.js';
import type { GameId, PlayerId, TileId, BuildingId, RoleCardId, ShipId } from './ids.js';
import type { GamePhase } from './phase.js';

export const RULESET = {
  id: 'puerto-rico-1897-special-edition-base-en',
  version: '1.0.0',
  sourceHash: '9240acbb1121a1e43019d9ae228603748c4447e36caf2be0c65c2ca2d8373c91',
} as const;

// Type IDs are closed semantic unions; physical instances use branded IDs.
export type Good = 'corn' | 'fruit' | 'sugar' | 'tobacco' | 'coffee';
export type Goods = Readonly<Record<Good, number>>;
export type Role = 'planter' | 'recruiter' | 'builder' | 'craftsman' | 'trader' | 'captain' | 'adventurer';
export type ScoringBuilding = 'fire-station' | 'residence' | 'fortress' | 'customs-house' | 'city-hall';
export type BuildingType =
  | 'small-fruit-depot' | 'small-sugar-mill' | 'large-fruit-depot' | 'large-sugar-mill'
  | 'large-tobacco-storage' | 'large-coffee-roaster' | 'small-market' | 'hacienda'
  | 'builders-yard' | 'small-warehouse' | 'hospital' | 'office' | 'large-market'
  | 'large-warehouse' | 'factory' | 'school' | 'harbor' | 'wharf' | ScoringBuilding;

export interface EstateTile { readonly instanceId: TileId; readonly kind: Good }
export interface CountrysideTile {
  readonly instanceId: TileId;
  readonly kind: Good | 'quarry';
  readonly occupied: boolean;
}
export interface BuildingInstance {
  readonly instanceId: BuildingId;
  readonly buildingTypeId: BuildingType;
  readonly occupiedSlots: number;
}
export type Cargo =
  | { readonly goodType: null; readonly loadedCount: 0 }
  | { readonly goodType: Good; readonly loadedCount: number };
export type CargoShip = Cargo & { readonly instanceId: ShipId; readonly capacity: 4 | 5 | 6 | 7 | 8 };
export type PersonalShip = Cargo & { readonly usedThisPhase: boolean };
export interface PlayerState {
  readonly playerId: PlayerId;
  readonly coins: number;
  readonly earnedVp: number;
  readonly countryside: readonly CountrysideTile[];
  readonly buildings: readonly BuildingInstance[];
  readonly idleWorkerCount: number;
  readonly goods: Goods;
  readonly personalShip: PersonalShip | null;
}
export interface RoleCard {
  readonly instanceId: RoleCardId;
  readonly kind: Role;
  readonly accumulatedCoins: number;
  readonly selectedBy: PlayerId | null;
}
export interface Supply {
  readonly goods: Goods;
  readonly workerCount: number;
  readonly workRegisterCount: number;
  readonly quarryCount: number;
  readonly buildingStock: Readonly<Record<BuildingType, number>>;
  readonly vpRemaining: number;
  readonly vpOverflow: number;
}
export type EndTrigger = {
  readonly triggeringRevision: number;
  readonly completion: 'phase-completion';
} & (
  | { readonly reason: 'worker-shortage'; readonly role: 'recruiter' }
  | { readonly reason: 'city-full'; readonly role: 'builder'; readonly playerId: PlayerId }
  | { readonly reason: 'vp-exhausted'; readonly role: 'captain' }
);
export interface FinalScoreBreakdown {
  readonly playerId: PlayerId;
  readonly earnedVp: number;
  readonly baseBuildingVp: number;
  readonly bonuses: Readonly<Record<ScoringBuilding, number>>;
  readonly totalVp: number;
  readonly tieBreakCoinsAndGoods: number;
  readonly rank: number;
}
export interface GameState {
  readonly schemaVersion: string;
  readonly engineVersion: string;
  readonly rulesetId: typeof RULESET.id;
  readonly rulesetVersion: typeof RULESET.version;
  readonly sourceHash: typeof RULESET.sourceHash;
  readonly gameId: GameId;
  readonly revision: number;
  readonly seatOrder: readonly PlayerId[];
  readonly players: readonly PlayerState[];
  readonly governorPlayerId: PlayerId;
  readonly roundNumber: number;
  readonly roleSelectionIndex: number;
  readonly roleCards: readonly RoleCard[];
  readonly phase: GamePhase;
  readonly supply: Supply;
  readonly estateBag: readonly EstateTile[];
  readonly estateDiscard: readonly EstateTile[];
  readonly estateMarket: readonly EstateTile[];
  readonly ships: readonly CargoShip[];
  readonly tradingHouse: readonly Good[];
  // Server-only state; never include it in a player view.
  readonly rng: RngState;
  readonly endTriggers: readonly EndTrigger[];
}
