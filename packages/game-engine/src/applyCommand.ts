import { useHacienda, useHospital } from './buildings/settlement.js';
import { retain } from './roles/captain/retain.js';
import { load } from './roles/captain/load.js';
import { resolveAdventurer } from './roles/prospector/resolve.js';
import { trade } from './roles/trader/trade.js';
import { produce, takeProductionBonus } from './roles/craftsman/produce.js';
import { placeWorkers } from './roles/mayor/placement.js';
import { recruitWorker } from './roles/mayor/distribute.js';
import { chooseRole } from './round/chooseRole.js';
import { advanceAutomatic } from './round/advanceAutomatic.js';
import { chooseTile } from './roles/settler/chooseTile.js';
import { build } from './roles/builder/build.js';
import { COMMANDS, ERRORS, inspectDecision } from './dispatch.js';
import type { GameCommand } from './model/commands.js';
import type { GameResult } from './model/events.js';
import type { GameState } from './model/state.js';

export function applyCommand(state: GameState, command: GameCommand): GameResult {
  // Defend the internal API against unknown JavaScript values too. Full payload
  // validation belongs to each role handler; the transport never supplies identity.
  const candidate: unknown = command;
  const record = typeof candidate==='object' && candidate!==null && !Array.isArray(candidate)
    ? candidate as Record<string,unknown> : null;
  const gate=inspectDecision(state,record?.actorId);
  if('error' in gate && gate.error.code!=='WRONG_ACTOR') return {ok:false,error:{...gate.error}};
  if(!record || typeof record.kind!=='string' || typeof record.actorId!=='string' || record.actorId.trim()===''
    || !Object.values(COMMANDS).some(kinds=>(kinds as readonly string[]).includes(record.kind as string))) {
    return {ok:false,error:{...ERRORS.unknown}};
  }
  if('error' in gate) return {ok:false,error:{...gate.error}};
  if(!(COMMANDS[gate.phase.kind] as readonly string[]).includes(record.kind)) return {ok:false,error:{...ERRORS.wrongPhase}};
  if(gate.phase.kind==='role-selection') return advanceAutomatic(chooseRole(state,gate.phase.actorId,record.roleCardId));
  if(gate.phase.kind==='planter-choice') return advanceAutomatic(chooseTile(state,record.choice));
  if(gate.phase.kind==='builder-choice') return advanceAutomatic(build(state,record.purchase));
  if(gate.phase.kind==='recruiter-advantage') return advanceAutomatic(recruitWorker(state,record.accept));
  if(gate.phase.kind==='recruiter-placement') return advanceAutomatic(placeWorkers(state,record.allocation));
  if(gate.phase.kind==='craftsman-production') return advanceAutomatic(produce(state,record.production));
  if(gate.phase.kind==='craftsman-bonus') return advanceAutomatic(takeProductionBonus(state,record.good));
  if(gate.phase.kind==='trader-choice') return advanceAutomatic(trade(state,record.sale));
  if(gate.phase.kind==='adventurer') return advanceAutomatic(resolveAdventurer(state,record.accept));
  if(gate.phase.kind==='captain-loading') return advanceAutomatic(load(state,record));
  if(gate.phase.kind==='captain-retention') return advanceAutomatic(retain(state,record.retained,record.warehouseTypes));
  if(gate.phase.kind==='planter-before') return advanceAutomatic(useHacienda(state,record.accept));
  if(gate.phase.kind==='planter-worker') return advanceAutomatic(useHospital(state,record.tileId));
  // Role actions remain explicitly unsupported until their own tickets.
  return {ok:false,error:{...ERRORS.unsupported}};
}
