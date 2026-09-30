import { fireStationBonus,residenceBonus,fortressBonus } from './scoringAssets.js';
import { customsHouseBonus,cityHallBonus } from './scoringPoints.js';
import type { FinalScoreBreakdown,PlayerState } from '../model/state.js';

export function calculateBuildingBonuses(player:PlayerState):FinalScoreBreakdown['bonuses'] {
 return {'fire-station':fireStationBonus(player),residence:residenceBonus(player),
  fortress:fortressBonus(player),'customs-house':customsHouseBonus(player),'city-hall':cityHallBonus(player)};
}
