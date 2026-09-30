import { isBuildingActive } from '../../buildings/activation.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { PlantingChoice } from '../../model/commands.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import { createId } from '../../model/ids.js';
import type { GameState } from '../../model/state.js';

export function availablePlantingChoices(state: GameState): PlantingChoice[] {
  if(state.phase.kind!=='planter-choice' || !Number.isSafeInteger(state.revision+1)) return [];
  const phase=state.phase;
  const player=state.players.find(p=>p.playerId===phase.actorId)!;
  if(player.countryside.length>=12) return [{kind:'decline'}];
  const estates=state.estateMarket.map(tile=>({kind:'estate' as const,tileId:tile.instanceId}));
  const quarry=state.supply.quarryCount>0 && (phase.actorIndex===0
    || isBuildingActive(player,'builders-yard'))
    ? [{kind:'quarry' as const}] : [];
  return [...estates,...quarry,{kind:'decline'}];
}

function nextQuarryId(state: GameState) {
  const used: Set<string>=new Set([...state.estateBag,...state.estateMarket,...state.estateDiscard,
    ...state.players.flatMap(p=>[...p.countryside,...p.buildings]),...state.roleCards,...state.ships]
    .map(entity=>entity.instanceId));
  let number=9-state.supply.quarryCount;
  while(used.has(`quarry-${number}`)) number++;
  return createId('tile',`quarry-${number}`);
}

export function chooseTile(state: GameState, choice: unknown): GameResult {
  if(state.phase.kind!=='planter-choice') throw new Error('Expected planter-choice');
  const phase=state.phase;
  const record=choice && typeof choice==='object' && !Array.isArray(choice) ? choice as Record<string,unknown> : null;
  const selected=record && Object.keys(record).length===(record.kind==='estate'?2:1)
    && availablePlantingChoices(state).find(option=>option.kind===record.kind
      && (option.kind!=='estate' || option.tileId===record.tileId));
  if(!selected) return {ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'PLANTER-001',message:'Choose a face-up estate, available Quarry, or decline.'}};
  const player=state.players.find(p=>p.playerId===phase.actorId)!;
  const tile=selected.kind==='estate'
    ? {...state.estateMarket.find(t=>t.instanceId===selected.tileId)!,occupied:false}
    : selected.kind==='quarry'
      ? {instanceId:nextQuarryId(state),kind:'quarry' as const,occupied:false}
      : null;
  const revision=state.revision+1;
  const next:GameState={...state,revision,
    players:tile?state.players.map(p=>p.playerId===player.playerId?{...p,countryside:[...p.countryside,tile]}:p):state.players,
    estateMarket:selected.kind==='estate'?state.estateMarket.filter(t=>t.instanceId!==selected.tileId):state.estateMarket,
    supply:selected.kind==='quarry'?{...state.supply,quarryCount:state.supply.quarryCount-1}:state.supply,
    phase:{...phase,kind:'planter-worker',acquiredTileIds:tile?[...phase.acquiredTileIds,tile.instanceId]:phase.acquiredTileIds},
  };
  assertGameState(next);
  const events:GameEvent[]=tile?[{kind:'tile-placed',revision,index:0,playerId:player.playerId,tile}]:[];
  events.push({kind:'phase-changed',revision,index:events.length,from:'planter-choice',to:'planter-worker'});
  return {ok:true,state:next,events};
}
