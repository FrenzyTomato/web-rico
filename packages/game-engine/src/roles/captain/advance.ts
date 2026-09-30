import { personalLoads, harborChoices } from '../../buildings/shipping.js';
import type { GameState } from '../../model/state.js';
import { cargoShipOptions } from './shipOptions.js';

export function captainOptions(state:GameState) {
  if(state.phase.kind!=='captain-loading')throw new Error('Expected captain-loading');
  const actorId=state.phase.actorId;
  const player=state.players.find(p=>p.playerId===actorId)!;
  const loads=cargoShipOptions(player.goods,state.ships);
  const personal=personalLoads(player);
  return {loads,personalLoads:personal,optionalWharf:personal.length>0,harborChoices:harborChoices(player)};
}

export function afterCaptainVisit(state:GameState,loaded:boolean):GameState {
  if(state.phase.kind!=='captain-loading')throw new Error('Expected captain-loading');
  const phase=state.phase,n=state.seatOrder.length;
  const consecutiveNoLoads=loaded?0:phase.consecutiveNoLoads+1;
  if(consecutiveNoLoads===n)return {...state,phase:{kind:'captain-retention',
    actorId:phase.roleChooserId,roleChooserId:phase.roleChooserId,actorIndex:0}};
  const actorIndex=(phase.actorIndex+1)%n;
  return {...state,phase:{...phase,actorIndex,consecutiveNoLoads,
    actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+actorIndex)%n]!}};
}
