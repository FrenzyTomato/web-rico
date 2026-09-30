import { InvariantError } from '../../invariants/assertGameState.js';
import type { GameState } from '../../model/state.js';
import { shuffle } from '../../rng/seeded.js';

export function completePlanter(state: GameState): GameState {
  if(state.phase.kind!=='phase-completion' || state.phase.role!=='planter') {
    throw new InvariantError('PLANTER-003','Expected Planter phase completion');
  }
  let bag=[...state.estateBag];
  let discard=[...state.estateDiscard,...state.estateMarket];
  let rng=state.rng;
  const market: GameState['estateMarket'][number][]=[];
  while(market.length<state.seatOrder.length+1) {
    if(bag.length===0) {
      if(discard.length===0) break;
      const mixed=shuffle(rng,discard);
      bag=[...mixed.items];discard=[];rng=mixed.rng;
    }
    market.push(bag.shift()!);
  }
  return {...state,estateBag:bag,estateDiscard:discard,estateMarket:market,rng};
}
