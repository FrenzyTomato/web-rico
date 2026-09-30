import { awardShipping } from './award.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { GameState } from '../../model/state.js';
import { afterCaptainVisit, captainOptions } from './advance.js';
import { findCargoShipOption } from './shipOptions.js';

function invalid():GameResult {
  return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'CAPTAIN-001',message:'Choose a legal full cargo load; decline Wharf only when no cargo load is possible.'}};
}
export function load(state:GameState,command:Record<string,unknown>):GameResult {
  if(state.phase.kind!=='captain-loading')throw new Error('Expected captain-loading');
  if(!Number.isSafeInteger(state.revision+1))return invalid();
  const actorId=state.phase.actorId,revision=state.revision+1;
  const player=state.players.find(p=>p.playerId===actorId)!;
  const options=captainOptions(state);
  const decline=command.kind==='decline-wharf';
  let next:GameState={...state,revision};
  const events:GameEvent[]=[];
  if(decline) {
    if(Object.keys(command).length!==2 || options.loads.length>0 || !options.optionalWharf)return invalid();
  } else {
    if(command.kind!=='load' || Object.keys(command).length!==4 || typeof command.useHarbor!=='boolean' || !options.harborChoices.includes(command.useHarbor))return invalid();
    const value=command.shipment;
    const shipment=value && typeof value==='object' && !Array.isArray(value)?value as Record<string,unknown>:null;
    if(!shipment)return invalid();
    const option=shipment.kind==='personal' && Object.keys(shipment).length===2
      ?options.personalLoads.find(o=>o.shipment.good===shipment.good)
      :shipment.kind==='cargo' && Object.keys(shipment).length===3
        ?findCargoShipOption(player.goods,state.ships,shipment.good,shipment.shipId):undefined;
    if(!option)return invalid();
    const {good}=option.shipment,quantity=option.quantity,target=option.shipment;
    next={...next,
      players:state.players.map(p=>p.playerId===actorId?{...p,goods:{...p.goods,[good]:p.goods[good]-quantity},
        personalShip:target.kind==='personal'?{goodType:good,loadedCount:quantity,usedThisPhase:true}:p.personalShip}:p),
      ships:target.kind==='cargo'?state.ships.map(ship=>ship.instanceId===target.shipId?{...ship,goodType:good,loadedCount:ship.loadedCount+quantity}:ship):state.ships,
    };
    events.push({kind:'goods-moved',revision,index:0,good,quantity,from:{kind:'player',playerId:actorId},
      to:target.kind==='cargo'?{kind:'cargo-ship',shipId:target.shipId}:{kind:'personal-ship',playerId:actorId}});
    const awarded=awardShipping(next,quantity,command.useHarbor);if(!awarded.ok)return awarded;
    next=awarded.state;
    events.push(...awarded.events.map((event,index)=>({...event,index:events.length+index}))); 
  }
  next=afterCaptainVisit(next,!decline);
  assertGameState(next);
  events.push({kind:'phase-changed',revision,index:events.length,from:'captain-loading',to:next.phase.kind});
  return {ok:true,state:next,events};
}
