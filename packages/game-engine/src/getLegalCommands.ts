import { warehouseCapacity } from './buildings/storage.js';
import { canUseHacienda, hospitalDestinations } from './buildings/settlement.js';
import { factoryChoices } from './buildings/economy.js';
import { captainOptions } from './roles/captain/advance.js';
import { adventurerChoices } from './roles/prospector/resolve.js';
import { availableSales } from './roles/trader/trade.js';
import { productionOutput, productionBonusChoices } from './roles/craftsman/produce.js';
import { placementOptions } from './roles/mayor/placement.js';
import { recruiterChoices } from './roles/mayor/distribute.js';
import { availableRoles } from './round/chooseRole.js';
import { availablePlantingChoices } from './roles/settler/chooseTile.js';
import { availableBuilds } from './roles/builder/build.js';
import { DispatchError, ERRORS, inspectDecision } from './dispatch.js';
import type { LegalAction } from './model/commands.js';
import type { PlayerId } from './model/ids.js';
import type { GameState } from './model/state.js';

export function getLegalCommands(state: GameState, playerId: PlayerId): LegalAction[] {
  const gate=inspectDecision(state,playerId);
  if('error' in gate) return [];
  if(gate.phase.kind==='role-selection') return [{phase:'role-selection',actorId:gate.phase.actorId,roleCardIds:availableRoles(state).map(card=>card.instanceId)}];
  if(gate.phase.kind==='planter-choice') return [{phase:'planter-choice',actorId:gate.phase.actorId,choices:availablePlantingChoices(state)}];
  if(gate.phase.kind==='builder-choice') return [{phase:'builder-choice',actorId:gate.phase.actorId,canDecline:true,purchases:availableBuilds(state)}];
  if(gate.phase.kind==='recruiter-advantage') return [{phase:'recruiter-advantage',actorId:gate.phase.actorId,accept:recruiterChoices(state)}];
  if(gate.phase.kind==='recruiter-placement') return Number.isSafeInteger(state.revision+1)?[placementOptions(state,playerId)]:[];
  if(gate.phase.kind==='craftsman-production') return Number.isSafeInteger(state.revision+1)?[{phase:'craftsman-production',actorId:gate.phase.actorId,canDecline:true,output:productionOutput(state),factoryChoices:factoryChoices(state.players.find(p=>p.playerId===gate.phase.actorId)!,productionOutput(state))}]:[];
  if(gate.phase.kind==='craftsman-bonus') return [{phase:'craftsman-bonus',actorId:gate.phase.actorId,goods:productionBonusChoices(state)}];
  if(gate.phase.kind==='trader-choice') {
    if(!Number.isSafeInteger(state.revision+1))return [];
    const offers=availableSales(state);
    return [{phase:'trader-choice',actorId:gate.phase.actorId,canDecline:true,sales:offers}];
  }
  if(gate.phase.kind==='adventurer') return [{phase:'adventurer',actorId:gate.phase.actorId,accept:adventurerChoices(state)}];
  if(gate.phase.kind==='captain-loading') {
    if(!Number.isSafeInteger(state.revision+1))return [];
    const options=captainOptions(state);
    if(options.loads.length===0 && !options.optionalWharf)return [];
    return [{phase:'captain-loading',actorId:gate.phase.actorId,loads:[...options.loads,...options.personalLoads],harborChoices:options.harborChoices,canDeclineWharf:options.loads.length===0 && options.optionalWharf}];
  }
  if(gate.phase.kind==='captain-retention') {
    const actorId=gate.phase.actorId,available=state.players.find(p=>p.playerId===actorId)!.goods;
    return Number.isSafeInteger(state.revision+1) && Object.values(available).some(n=>n>0)?[{phase:'captain-retention',actorId,available:{...available},maxWarehouseTypes:warehouseCapacity(state.players.find(p=>p.playerId===actorId)!),extraSingleCrates:1}]:[];
  }
  if(gate.phase.kind==='planter-before') return [{phase:'planter-before',actorId:gate.phase.actorId,accept:Number.isSafeInteger(state.revision+1)?canUseHacienda(state)?[false,true]:[false]:[]}];
  if(gate.phase.kind==='planter-worker') return [{phase:'planter-worker',actorId:gate.phase.actorId,tileIds:Number.isSafeInteger(state.revision+1)?hospitalDestinations(state):[]}];
  // Later role handlers supply bounded descriptors through this same gate.
  throw new DispatchError(ERRORS.unsupported);
}
