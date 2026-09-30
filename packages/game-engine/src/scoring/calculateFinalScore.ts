import { BUILDINGS } from '../buildings/definitions.js';
import { calculateBuildingBonuses } from '../buildings/scoring.js';
import { InvariantError } from '../invariants/assertGameState.js';
import type { FinalScoreBreakdown,GameState } from '../model/state.js';

/** Pure final-snapshot calculation; results preserve seat order with competition ranks. */
export function calculateFinalScore(state:GameState):FinalScoreBreakdown[] {
 const scores=state.seatOrder.map(playerId=>{
  const player=state.players.find(p=>p.playerId===playerId)!;
  const bonuses=calculateBuildingBonuses(player);
  const baseBuildingVp=player.buildings.reduce((total,b)=>total+BUILDINGS[b.buildingTypeId].baseVp,0);
  const totalVp=player.earnedVp+baseBuildingVp+Object.values(bonuses).reduce((a,b)=>a+b,0);
  const tieBreakCoinsAndGoods=player.coins+Object.values(player.goods).reduce((a,b)=>a+b,0);
  if(!Number.isSafeInteger(totalVp))throw new InvariantError('SCORE-001','Numeric score limit exceeded');
  if(!Number.isSafeInteger(tieBreakCoinsAndGoods))throw new InvariantError('SCORE-002','Numeric tiebreak limit exceeded');
  return {playerId,earnedVp:player.earnedVp,baseBuildingVp,bonuses,totalVp,tieBreakCoinsAndGoods,rank:1};
 });
 return scores.map(score=>({...score,rank:1+scores.filter(other=>other.totalVp>score.totalVp
  || (other.totalVp===score.totalVp && other.tieBreakCoinsAndGoods>score.tieBreakCoinsAndGoods)).length}));
}
