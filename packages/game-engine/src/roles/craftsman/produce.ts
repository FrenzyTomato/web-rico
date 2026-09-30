import { factoryChoices, factoryIncome } from '../../buildings/economy.js';
import { assertGameState } from '../../invariants/assertGameState.js';
import type { GameEvent, GameResult } from '../../model/events.js';
import type { BuildingType, GameState, Good, Goods } from '../../model/state.js';

const goods:readonly Good[]=['corn','fruit','sugar','tobacco','coffee'];
const processing:Partial<Record<BuildingType,Good>>={
 'small-fruit-depot':'fruit','large-fruit-depot':'fruit','small-sugar-mill':'sugar','large-sugar-mill':'sugar',
 'large-tobacco-storage':'tobacco','large-coffee-roaster':'coffee',
};
export function productionOutput(state:GameState):Goods {
 if(state.phase.kind!=='craftsman-production')throw new Error('Expected craftsman-production');
 const actorId=state.phase.actorId,p=state.players.find(p=>p.playerId===actorId)!;
 const output:Record<Good,number>={corn:0,fruit:0,sugar:0,tobacco:0,coffee:0};
 for(const good of goods){
  const estates=p.countryside.filter(t=>t.kind===good && t.occupied).length;
  const slots=good==='corn'?estates:p.buildings.reduce((n,b)=>n+(processing[b.buildingTypeId]===good?b.occupiedSlots:0),0);
  output[good]=Math.min(estates,slots,state.supply.goods[good]);
 }
 return output;
}
export function afterProduction(state:GameState,produced:readonly Good[]):GameState {
 if(state.phase.kind!=='craftsman-production')throw new Error('Expected craftsman-production');
 const phase=state.phase,chooserProducedTypes=phase.actorIndex===0?produced:phase.chooserProducedTypes;
 return {...state,phase:phase.actorIndex===state.seatOrder.length-1
  ?{...phase,kind:'craftsman-bonus',actorId:phase.roleChooserId,actorIndex:0,chooserProducedTypes}
  :{...phase,actorIndex:phase.actorIndex+1,actorId:state.seatOrder[(state.seatOrder.indexOf(phase.roleChooserId)+phase.actorIndex+1)%state.seatOrder.length]!,chooserProducedTypes}};
}
export function productionBonusChoices(state:GameState):readonly (Good|null)[] {
 if(state.phase.kind!=='craftsman-bonus' || !Number.isSafeInteger(state.revision+1))return [];
 return [null,...state.phase.chooserProducedTypes.filter(g=>state.supply.goods[g]>0)];
}
const invalid=():GameResult=>({ok:false,error:{code:'ILLEGAL_CHOICE',ruleId:'CRAFTSMAN-001',message:'Choose full production or decline; choose only an available production bonus.'}});
export function produce(state:GameState,input:unknown):GameResult {
 if(state.phase.kind!=='craftsman-production')throw new Error('Expected craftsman-production');
 if(!Number.isSafeInteger(state.revision+1) || typeof input!=='object' || input===null || Array.isArray(input))return invalid();
 const choice=input as Record<string,unknown>;
 const output=productionOutput(state),revision=state.revision+1,actorId=state.phase.actorId;
 const actor=state.players.find(p=>p.playerId===actorId)!;
 if(!(choice.accept===false && Object.keys(choice).length===1) && !(choice.accept===true && typeof choice.useFactory==='boolean' && factoryChoices(actor,output).includes(choice.useFactory) && Object.keys(choice).length===2))return invalid();
 const produced=choice.accept?goods.filter(g=>output[g]>0):[];
 const income=choice.accept && choice.useFactory?factoryIncome(output):0;
 const supply={...state.supply.goods},events:GameEvent[]=[];
 const players=state.players.map(p=>{
  if(p.playerId!==actorId)return p;
  const inventory={...p.goods};
  for(const good of produced){inventory[good]+=output[good];supply[good]-=output[good];events.push({kind:'goods-moved',revision,index:events.length,good,quantity:output[good],from:{kind:'supply'},to:{kind:'player',playerId:actorId}});}
  return {...p,goods:inventory,coins:p.coins+income};
 });
 if(income>0)events.push({kind:'coins-changed',revision,index:events.length,playerId:actorId,delta:income});
 const next=afterProduction({...state,revision,players,supply:{...state.supply,goods:supply}},produced);assertGameState(next);
 events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});
 return {ok:true,state:next,events};
}
export function takeProductionBonus(state:GameState,good:unknown):GameResult {
 if(state.phase.kind!=='craftsman-bonus')throw new Error('Expected craftsman-bonus');
 if(!productionBonusChoices(state).some(choice=>choice===good))return invalid();
 const selected=good as Good|null,revision=state.revision+1,actorId=state.phase.roleChooserId;
 const next:GameState={...state,revision,
  players:selected?state.players.map(p=>p.playerId===actorId?{...p,goods:{...p.goods,[selected]:p.goods[selected]+1}}:p):state.players,
  supply:selected?{...state.supply,goods:{...state.supply.goods,[selected]:state.supply.goods[selected]-1}}:state.supply,
  phase:{kind:'phase-completion',role:'craftsman',roleChooserId:actorId}};
 assertGameState(next);
 const events:GameEvent[]=selected?[{kind:'goods-moved',revision,index:0,good:selected,quantity:1,from:{kind:'supply'},to:{kind:'player',playerId:actorId}}]:[];
 events.push({kind:'phase-changed',revision,index:events.length,from:state.phase.kind,to:next.phase.kind});
 return {ok:true,state:next,events};
}
