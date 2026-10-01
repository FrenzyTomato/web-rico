import { completeGame } from '../scoring/endgame.js';
import { canUseHacienda, hospitalDestinations, afterPlanting } from '../buildings/settlement.js';
import { afterRetention } from '../roles/captain/retain.js';
import { completeCaptain } from '../roles/captain/complete.js';
import { captainOptions, afterCaptainVisit } from '../roles/captain/advance.js';
import { availableSales, afterTrade, completeTrade } from '../roles/trader/trade.js';
import { productionOutput, afterProduction } from '../roles/craftsman/produce.js';
import { distributeWorkers } from '../roles/mayor/distribute.js';
import { ERRORS } from '../dispatch.js';
import { assertGameState, InvariantError } from '../invariants/assertGameState.js';
import type { GameResult } from '../model/events.js';
import type { GameState } from '../model/state.js';
import { advanceAfterRole, advanceRound } from './advanceRound.js';
import { availablePlantingChoices } from '../roles/settler/chooseTile.js';
import { completePlanter } from '../roles/settler/complete.js';
import { availableBuilds } from '../roles/builder/build.js';

type AutomaticStep = (state: GameState) => GameResult | null;

function nextAutomatic(state: GameState): GameResult | null {
  const phase=state.phase;
  let next: GameState;
  switch(phase.kind) {
    case 'planter-before': {
      if(canUseHacienda(state))return null;
      next={...state,phase:{...phase,kind:'planter-choice',acquiredTileIds:[]}};
      break;
    }
    case 'planter-choice':
      if(availablePlantingChoices(state).length>1) return null;
      next={...state,phase:{...phase,kind:'planter-worker'}};
      break;
    case 'planter-worker':
      if(hospitalDestinations(state).length>1)return null;
      next=afterPlanting(state);
      break;
    case 'builder-choice':
      // Skip actors with nothing affordable, also after a City-full trigger (AUD-06 user ruling, 2026-10-01).
      if(availableBuilds(state).length>0) return null;
      next={...state,phase:phase.actorIndex===state.seatOrder.length-1
        ? {kind:'phase-completion',role:'builder',roleChooserId:phase.roleChooserId}
        : {...phase,actorIndex:phase.actorIndex+1,
          actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!}};
      break;
    case 'captain-retention': {
      const actorId=phase.actorId;
      if(Object.values(state.players.find(p=>p.playerId===actorId)!.goods).some(n=>n>0))return null;
      next=afterRetention(state);
      break;
    }
    case 'captain-loading': {
      const options=captainOptions(state);
      if(options.loads.length>0 || options.optionalWharf)return null;
      next=afterCaptainVisit(state,false);
      break;
    }
    case 'trader-choice':
      if(availableSales(state).length>0)return null;
      next=afterTrade(state);
      break;
    case 'craftsman-production':
      if(Object.values(productionOutput(state)).some(count=>count>0))return null;
      next=afterProduction(state,[]);
      break;
    case 'craftsman-bonus':
      if(phase.chooserProducedTypes.some(good=>state.supply.goods[good]>0)) return null;
      next={...state,phase:{kind:'phase-completion',role:'craftsman',roleChooserId:phase.roleChooserId}};
      break;
    case 'phase-completion':
      if(phase.role==='captain')return completeCaptain(state);
      if(state.endTriggers.length>0) return completeGame(state);
      if(phase.role==='trader' && state.endTriggers.length===0){
        const cleanup=completeTrade(state);if(!cleanup.ok)return cleanup;
        const rotated=advanceAfterRole(cleanup.state);
        return {ok:true,state:rotated,events:[...cleanup.events,{kind:'phase-changed',revision:state.revision,index:cleanup.events.length,from:phase.kind,to:rotated.phase.kind}]};
      }
      if(state.endTriggers.length>0 || !['planter','builder','recruiter','craftsman','adventurer'].includes(phase.role)) {
        return {ok:false,error:{...ERRORS.unsupported}};
      }
      next=advanceAfterRole(phase.role==='planter'?completePlanter(state):state);
      break;
    case 'round-completion':
      next=advanceRound(state);
      break;
    case 'recruiter-advantage':
      if(state.supply.workerCount>0)return null;
      next={...state,phase:{kind:'recruiter-distribution',roleChooserId:phase.roleChooserId}};
      break;
    case 'recruiter-distribution':
      return distributeWorkers(state);
    default:
      return null;
  }
  return {ok:true,state:next,events:[{kind:'phase-changed',revision:state.revision,index:0,from:phase.kind,to:next.phase.kind}]};
}

export function advanceAutomatic(input: GameResult, step: AutomaticStep=nextAutomatic): GameResult {
  if(!input.ok) return input;
  assertGameState(input.state);
  let current=input;
  for(let count=0;count<128;count++) {
    const state=current.state;
    if(state.phase.kind==='game-over') return current;
    const next=step(state);
    if(next===null) {
      if(!('actorId' in state.phase)) {
        throw new InvariantError('ROLE-001','Automatic progression must stop at a decision');
      }
      return current;
    }
    if(!next.ok) return next;
    if(next.state.revision!==state.revision || next.events.some(event=>event.revision!==state.revision)) {
      throw new InvariantError('ROLE-001','Automatic progression cannot change revision');
    }
    assertGameState(next.state);
    if(JSON.stringify(next.state)===JSON.stringify(state)) throw new InvariantError('ROLE-001','Automatic progression made no progress');
    current={ok:true,state:next.state,events:[...current.events,
      ...next.events.map((event,index)=>({...event,index:current.events.length+index})),
    ]};
  }
  throw new InvariantError('ROLE-001','Automatic progression exceeded the step limit');
}
