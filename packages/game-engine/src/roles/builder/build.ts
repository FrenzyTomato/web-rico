import { schoolWorkerSource } from '../../buildings/construction.js';
import { BUILDINGS } from '../../buildings/definitions.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { LegalAction } from '../../model/commands.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import { createId } from '../../model/ids.js';
import type { BuildingType, GameState } from '../../model/state.js';

const footprint=(type:BuildingType)=>BUILDINGS[type].footprint;
const citySize=(buildings:GameState['players'][number]['buildings'])=>buildings.reduce((size,b)=>size+footprint(b.buildingTypeId),0);
type PurchaseOption=Extract<LegalAction,{phase:'builder-choice'}>['purchases'][number];

export function availableBuilds(state:GameState):PurchaseOption[] {
  if(state.phase.kind!=='builder-choice' || !Number.isSafeInteger(state.revision+1))return [];
  const phase=state.phase;
  const player=state.players.find(p=>p.playerId===phase.actorId)!;
  const occupiedQuarries=player.countryside.filter(tile=>tile.kind==='quarry' && tile.occupied).length;
  const remaining=12-citySize(player.buildings);
  const offers:PurchaseOption[]=[];
  for(const type of Object.keys(BUILDINGS) as BuildingType[]) {
    const {cost,quarryCap:cap}=BUILDINGS[type];
    if(state.supply.buildingStock[type]===0 || player.buildings.some(b=>b.buildingTypeId===type) || footprint(type)>remaining)continue;
    for(const useAdvantage of phase.actorIndex===0?[false,true]:[false]) {
      const price=Math.max(0,cost-Math.min(occupiedQuarries,cap)-(useAdvantage?1:0));
      if(price<=player.coins)offers.push({buildingTypeId:type,useAdvantage,price,schoolChoices:schoolWorkerSource(player,state.supply)?[false,true]:[false]});
    }
  }
  return offers;
}

function nextBuildingId(state:GameState,type:BuildingType) {
  const used: Set<string>=new Set([...state.estateBag,...state.estateMarket,...state.estateDiscard,
    ...state.players.flatMap(p=>[...p.countryside,...p.buildings]),...state.roleCards,...state.ships]
    .map(entity=>entity.instanceId));
  let serial=state.players.reduce((count,p)=>count+p.buildings.filter(b=>b.buildingTypeId===type).length,0)+1;
  while(used.has(`building-${type}-${serial}`))serial++;
  return createId('building',`building-${type}-${serial}`);
}

export function build(state:GameState,purchase:unknown):GameResult {
  if(state.phase.kind!=='builder-choice')throw new Error('Expected builder-choice');
  const phase=state.phase;
  const record=purchase && typeof purchase==='object' && !Array.isArray(purchase) ? purchase as Record<string,unknown>:null;
  const option=record && Object.keys(record).length===3 && typeof record.useSchool==='boolean'
    ? availableBuilds(state).find(p=>p.buildingTypeId===record.buildingTypeId && p.useAdvantage===record.useAdvantage && p.schoolChoices.includes(record.useSchool as boolean))
    : undefined;
  if(purchase!==null && !option)return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'BUILDER-001',message:'Choose an affordable in-stock building, or decline.'}};
  const actor=state.players.find(p=>p.playerId===phase.actorId)!;
  const workerSource=option && record!.useSchool?schoolWorkerSource(actor,state.supply):null;
  const revision=state.revision+1;
  const building=option?{instanceId:nextBuildingId(state,option.buildingTypeId),buildingTypeId:option.buildingTypeId,occupiedSlots:workerSource?1:0}:null;
  const full=building!==null && citySize(actor.buildings)+footprint(building.buildingTypeId)===12;
  const trigger=full?{reason:'city-full' as const,role:'builder' as const,playerId:actor.playerId,triggeringRevision:revision,completion:'phase-completion' as const}:null;
  const next:GameState={...state,revision,
    players:building?state.players.map(p=>p.playerId===actor.playerId?{...p,coins:p.coins-option!.price,
      buildings:[...p.buildings,building],personalShip:building.buildingTypeId==='wharf'
        ?{goodType:null,loadedCount:0,usedThisPhase:false}:p.personalShip}:p):state.players,
    supply:building?{...state.supply,workerCount:state.supply.workerCount-Number(workerSource==='supply'),
      workRegisterCount:state.supply.workRegisterCount-Number(workerSource==='register'),buildingStock:{...state.supply.buildingStock,
      [building.buildingTypeId]:state.supply.buildingStock[building.buildingTypeId]-1}}:state.supply,
    endTriggers:trigger?[...state.endTriggers,trigger]:state.endTriggers,
    phase:phase.actorIndex===state.seatOrder.length-1?{kind:'phase-completion',role:'builder',roleChooserId:phase.roleChooserId}
      :{...phase,actorIndex:phase.actorIndex+1,
        actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!},
  };
  assertGameState(next);
  const events:GameEvent[]=[];
  if(building)events.push({kind:'building-built',revision,index:events.length,playerId:actor.playerId,building});
  if(option && option.price>0)events.push({kind:'coins-changed',revision,index:events.length,playerId:actor.playerId,delta:-option.price});
  if(workerSource)events.push({kind:'workers-received',revision,index:events.length,playerId:actor.playerId,quantity:1,source:workerSource});
  if(trigger)events.push({kind:'end-triggered',revision,index:events.length,trigger});
  events.push({kind:'phase-changed',revision,index:events.length,from:'builder-choice',to:next.phase.kind});
  return {ok:true,state:next,events};
}
