import type { BuildingType, EndTrigger, Good, Role } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';

/** Chinese display terms (ARCHITECTURE: Chinese display text). Engine IDs stay unchanged underneath. */
export const ROLE: Record<Role, string> = {
  planter: '种植者', recruiter: '招募者', builder: '建筑师', craftsman: '工匠', trader: '商人', captain: '船长', adventurer: '冒险者',
};
export const GOOD: Record<Good, string> = { corn: '玉米', fruit: '水果', sugar: '糖', tobacco: '烟草', coffee: '咖啡' };
export const TILE: Record<Good | 'quarry', string> = { ...GOOD, quarry: '采石场' };
export const BUILDING: Record<BuildingType, string> = {
  'small-fruit-depot': '小水果仓', 'small-sugar-mill': '小糖厂', 'large-fruit-depot': '大水果仓', 'large-sugar-mill': '大糖厂',
  'large-tobacco-storage': '烟草仓库', 'large-coffee-roaster': '咖啡烘焙厂', 'small-market': '小市场', hacienda: '大庄园',
  'builders-yard': '建筑工场', 'small-warehouse': '小仓库', hospital: '医院', office: '办事处', 'large-market': '大市场',
  'large-warehouse': '大仓库', factory: '工厂', school: '学校', harbor: '港口', wharf: '码头',
  'fire-station': '消防站', residence: '官邸', fortress: '堡垒', 'customs-house': '海关', 'city-hall': '市政厅',
};
export const PHASE: Record<PlayerView['phase']['kind'], string> = {
  'role-selection': '选择角色', 'planter-before': '种植（大庄园）', 'planter-choice': '种植', 'planter-worker': '种植（医院）',
  'recruiter-advantage': '招募特权', 'recruiter-distribution': '分发工人', 'recruiter-placement': '分配工人', 'builder-choice': '建造',
  'craftsman-production': '生产', 'craftsman-bonus': '工匠特权', 'trader-choice': '交易', 'captain-loading': '装船',
  'captain-retention': '保留货物', adventurer: '冒险者', 'phase-completion': '阶段结算', 'round-completion': '回合结算', 'game-over': '游戏结束',
};
export const END_REASON: Record<EndTrigger['reason'], string> = { 'worker-shortage': '工人不足', 'city-full': '城市建满', 'vp-exhausted': '分数用尽' };
