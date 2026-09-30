import { expectTypeOf, it } from 'vitest';
import type { GameEvent, GameState, LegalAction, PlayerState } from '@vibe-rico/game-engine';
import type { CommandRejected, PlayerBroadcast, PlayerEvent, PlayerView, PublicPlayerView } from '../src/index.js';

// Exact key sets: adding any GameState field to a DTO fails compilation until this audit is revisited.
it('VIS-01: PlayerView carries only VISIBILITY-001 public fields plus the viewer’s own VP', () => {
  expectTypeOf<keyof PlayerView>().toEqualTypeOf<'viewer' | 'seatOrder' | 'players' | 'governorPlayerId'
    | 'roundNumber' | 'roleSelectionIndex' | 'roleCards' | 'phase' | 'supply' | 'estateMarket' | 'ships' | 'tradingHouse'>();
  expectTypeOf<keyof PlayerView['viewer']>().toEqualTypeOf<'playerId' | 'earnedVp'>();
  // Server-only GameState fields: RNG, future estate order/identities, and snapshot metadata.
  expectTypeOf<Extract<keyof GameState, keyof PlayerView>>().toEqualTypeOf<'seatOrder' | 'players' | 'governorPlayerId'
    | 'roundNumber' | 'roleSelectionIndex' | 'roleCards' | 'phase' | 'supply' | 'estateMarket' | 'ships' | 'tradingHouse'>();
});

it('VIS-01: other players’ earned VP is absent from public player entries', () => {
  expectTypeOf<keyof PublicPlayerView>().toEqualTypeOf<Exclude<keyof PlayerState, 'earnedVp'>>();
});

it('VIS-01: events withhold end triggers; legal actions and errors add no hidden fields', () => {
  expectTypeOf<PlayerEvent['kind']>().toEqualTypeOf<Exclude<GameEvent['kind'], 'end-triggered'>>();
  expectTypeOf<PlayerBroadcast['legalActions'][number]>().toEqualTypeOf<LegalAction>();
  expectTypeOf<keyof PlayerBroadcast>().toEqualTypeOf<'protocolVersion' | 'revision' | 'view' | 'legalActions' | 'events'>();
  expectTypeOf<keyof CommandRejected>().toEqualTypeOf<'commandId' | 'code' | 'ruleId' | 'currentRevision'>();
});
