import { createId, RULESET, seedRng } from '../../src/index.js';
import type { GameState, Good, BuildingType } from '../../src/index.js';
export type Mutable<T> = T extends string | number | boolean | null ? T : { -readonly [K in keyof T]: Mutable<T[K]> };
// Independent controlled snapshots, not a production setup implementation.
export function fixture(n = 3): Mutable<GameState> {
  const goods = { corn: 10, fruit: 11, sugar: 11, tobacco: 9, coffee: 9 };
  const zero = { corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 };
  const stock: Record<BuildingType, number> = {
    'small-fruit-depot':4,'small-sugar-mill':4,'large-fruit-depot':3,'large-sugar-mill':3,
    'large-tobacco-storage':3,'large-coffee-roaster':3,'small-market':2,hacienda:2,
    'builders-yard':2,'small-warehouse':2,hospital:2,office:2,'large-market':2,
    'large-warehouse':2,factory:2,school:2,harbor:2,wharf:2,
    'fire-station':1,residence:1,fortress:1,'customs-house':1,'city-hall':1,
  };
  const seats = Array.from({ length:n }, (_,i) => createId('player', `p${i}`));
  const estates = (Object.entries({ corn:10,fruit:12,sugar:11,tobacco:9,coffee:8 }) as [Good,number][])
    .flatMap(([kind,total]) => Array.from({ length:total }, (_,i) => ({ kind, instanceId:createId('tile',`${kind}-${i}`) })));
  const players = seats.map((playerId,i) => {
    const kind = i < (n === 5 ? 3 : 2) ? 'fruit' : 'corn';
    const at = estates.findIndex(t => t.kind === kind);
    const tile = estates.splice(at,1)[0]!;
    return { playerId, coins:n-1, earnedVp:0, countryside:[{ ...tile, occupied:false }],
      buildings:[], idleWorkerCount:0, goods:{ ...zero }, personalShip:null };
  });
  return {
    schemaVersion:'1.0.0',engineVersion:'0.0.0',rulesetId:RULESET.id,rulesetVersion:RULESET.version,sourceHash:RULESET.sourceHash,
    gameId:createId('game','test'),revision:1,seatOrder:seats,players,governorPlayerId:seats[0]!,roundNumber:1,roleSelectionIndex:0,
    roleCards:[...(['planter','recruiter','builder','craftsman','trader','captain'] as const),
      ...Array.from({length:n-3},() => 'adventurer' as const)].map((kind,i)=>({kind,instanceId:createId('role-card',`role-${i}`),accumulatedCoins:0,selectedBy:null})),
    phase:{kind:'role-selection',actorId:seats[0]!},
    supply:{goods,workerCount:n===3?55:n===4?75:95,workRegisterCount:n,quarryCount:8,buildingStock:stock,vpRemaining:n===3?75:n===4?100:126,vpOverflow:0},
    estateMarket:estates.splice(0,n+1),estateBag:estates,estateDiscard:[],
    ships:[n+1,n+2,n+3].map((capacity,i)=>({instanceId:createId('ship',`ship-${i}`),capacity:capacity as 4|5|6|7|8,goodType:null,loadedCount:0})),
    tradingHouse:[],rng:seedRng(1) as Mutable<GameState['rng']>,endTriggers:[],
  };
}
