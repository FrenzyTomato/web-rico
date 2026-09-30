import type {
  BuildingInstance, CargoShip, CountrysideTile, EstateTile, GameEvent, GamePhase, Good, Goods,
  LegalAction, PersonalShip, PlayerId, RoleCard, Supply,
} from '@vibe-rico/game-engine';

/**
 * Field-by-field projection of GameState (RULES.md VISIBILITY-001–003, GAME_STATE.md "Visibility and replay").
 * Omitted as server-only: rng, estateBag, estateDiscard, endTriggers, snapshot/ruleset metadata,
 * gameId and revision (the broadcast envelope carries revision), and every other player's earnedVp.
 */
export interface PublicPlayerView {
  readonly playerId: PlayerId;
  readonly coins: number;
  readonly countryside: readonly CountrysideTile[];
  readonly buildings: readonly BuildingInstance[];
  readonly idleWorkerCount: number;
  readonly goods: Goods;
  readonly personalShip: PersonalShip | null;
}
export interface PlayerView {
  /** VISIBILITY-002: the viewer sees only their own earned VP before game over. */
  readonly viewer: { readonly playerId: PlayerId; readonly earnedVp: number };
  readonly seatOrder: readonly PlayerId[];
  readonly players: readonly PublicPlayerView[];
  readonly governorPlayerId: PlayerId;
  readonly roundNumber: number;
  readonly roleSelectionIndex: number;
  readonly roleCards: readonly RoleCard[];
  /** Decision phases carry only public turn data; game-over scores reveal every breakdown (VISIBILITY-002). */
  readonly phase: GamePhase;
  readonly supply: Supply;
  /** Face-up estates only; bag order and identities stay server-only (VISIBILITY-003). */
  readonly estateMarket: readonly EstateTile[];
  readonly ships: readonly CargoShip[];
  readonly tradingHouse: readonly Good[];
}
/**
 * Canonical events after the snapshot filter (VISIBILITY-003): `vp-earned` reaches only its owner and
 * `end-triggered` is withheld like endTriggers. Kept events retain their canonical revision/index.
 */
export type PlayerEvent = Exclude<GameEvent, { readonly kind: 'end-triggered' }>;
/** Only the current decision-maker receives legal actions; every other viewer receives none. */
export type PlayerLegalActions = readonly LegalAction[];
