import { assertGameState } from '../invariants/assertGameState.js';
import { createId } from '../model/ids.js';
import type { GameId, PlayerId } from '../model/ids.js';
import { SNAPSHOT_ENGINE_VERSION, SNAPSHOT_SCHEMA_VERSION } from '../model/serialization.js';
import { RULESET } from '../model/state.js';
import type { GameState, PlayerState, Role } from '../model/state.js';
import type { GameResult, RuleError } from '../model/events.js';
import { seedRng, shuffle } from '../rng/seeded.js';
import { BASE_ROLES, BUILDING_STOCK, ESTATES, GOODS, PLAYER_CONFIG } from './config.js';

export interface CreateGameInput {
  readonly rulesetId: typeof RULESET.id;
  readonly gameId: GameId;
  readonly seatOrder: readonly PlayerId[];
  readonly governorPlayerId: PlayerId;
  readonly seed: number;
}
export type CreateGameResult = GameResult;
const nonblank = (value: unknown): value is string => typeof value==='string' && value.trim().length>0;
function fail(message: string, code: RuleError['code']='INVALID_SETUP'): CreateGameResult {
  return {ok:false,error:{code,ruleId:'SETUP-001',message}};
}
/** Deterministic setup. Governor/clockwise seats are chosen by the caller, not randomized. */
export function createGame(input: CreateGameInput): CreateGameResult {
  if(!input || typeof input!=='object' || Array.isArray(input)) return fail('Setup input must be an object.');
  if(input.rulesetId!==RULESET.id) return fail('Unsupported ruleset.','UNSUPPORTED_RULESET');
  if(!Array.isArray(input.seatOrder)) return fail('Seat order must be an array.');
  const n=input.seatOrder.length;
  if(n!==3 && n!==4 && n!==5) return fail('Setup requires 3, 4, or 5 players.');
  // Array.from also rejects holes that Array.every alone would skip.
  if(!nonblank(input.gameId) || !Array.from(input.seatOrder).every(nonblank)
    || new Set(input.seatOrder).size!==n) return fail('Game and player IDs must be nonblank, with distinct players.');
  const governorIndex=input.seatOrder.indexOf(input.governorPlayerId);
  if(governorIndex<0) return fail('Governor must be a seated player.');
  if(!Number.isInteger(input.seed) || input.seed<0 || input.seed>0xffffffff) return fail('Seed must be an unsigned 32-bit integer.');
  const config=PLAYER_CONFIG[n];
  const shuffled=shuffle(seedRng(input.seed),ESTATES.flatMap(([kind,count])=>
    Array.from({length:count},(_,i)=>({instanceId:createId('tile',`estate-${kind}-${i+1}`),kind}))));
  const bag=[...shuffled.items];
  const estateMarket=bag.splice(0,n+1);
  // Take prescribed starting types clockwise from the Governor AFTER the market draw.
  const bySeat=new Map<PlayerId,PlayerState>();
  for(let offset=0;offset<n;offset++) {
    const playerId=input.seatOrder[(governorIndex+offset)%n]!;
    const kind=config.starting[offset]!;
    const at=bag.findIndex(tile=>tile.kind===kind);
    if(at<0) throw new Error('Starting estate unavailable: inconsistent setup constants');
    const tile=bag.splice(at,1)[0]!;
    bySeat.set(playerId,{
      playerId,coins:config.coins,earnedVp:0,countryside:[{...tile,occupied:false}],buildings:[],
      idleWorkerCount:0,goods:{corn:0,fruit:0,sugar:0,tobacco:0,coffee:0},personalShip:null,
    });
  }
  const roles: Role[]=[...BASE_ROLES,...Array.from({length:n-3},()=> 'adventurer' as const)];
  const state: GameState={
    schemaVersion:SNAPSHOT_SCHEMA_VERSION,engineVersion:SNAPSHOT_ENGINE_VERSION,
    rulesetId:RULESET.id,rulesetVersion:RULESET.version,sourceHash:RULESET.sourceHash,
    gameId:input.gameId,revision:0,seatOrder:[...input.seatOrder],
    players:input.seatOrder.map(id=>bySeat.get(id)!),governorPlayerId:input.governorPlayerId,
    roundNumber:1,roleSelectionIndex:0,
    roleCards:roles.map((kind,i)=>({instanceId:createId('role-card',`role-${i+1}`),kind,accumulatedCoins:0,selectedBy:null})),
    phase:{kind:'role-selection',actorId:input.governorPlayerId},
    supply:{goods:{...GOODS},workerCount:config.workers,workRegisterCount:n,quarryCount:8,
      buildingStock:{...BUILDING_STOCK},vpRemaining:config.vp,vpOverflow:0},
    estateBag:bag,estateDiscard:[],estateMarket,
    ships:config.ships.map(capacity=>({instanceId:createId('ship',`ship-${capacity}`),capacity,goodType:null,loadedCount:0})),
    tradingHouse:[],rng:shuffled.rng,endTriggers:[],
  };
  assertGameState(state);
  return {ok:true,state,events:[]};
}
