import { t } from './language.js';
import type { BuildingType, EndTrigger, Good, Role } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';

/** Live display terms; engine IDs remain independent of the selected language. */
export const ROLE: Record<Role, string> = {
  get planter() { return t("种植者"); }, get recruiter() { return t("招募者"); }, get builder() { return t("建筑师"); }, get craftsman() { return t("工匠"); }, get trader() { return t("商人"); }, get captain() { return t("船长"); }, get adventurer() { return t("冒险者"); },
};
export const GOOD: Record<Good, string> = { get corn() { return t("玉米"); }, get fruit() { return t("水果"); }, get sugar() { return t("糖"); }, get tobacco() { return t("烟草"); }, get coffee() { return t("咖啡"); } };
export const TILE: Record<Good | 'quarry', string> = { get corn() { return GOOD.corn; }, get fruit() { return GOOD.fruit; }, get sugar() { return GOOD.sugar; }, get tobacco() { return GOOD.tobacco; }, get coffee() { return GOOD.coffee; }, get quarry() { return t("采石场"); } };
export const BUILDING: Record<BuildingType, string> = {
  get 'small-fruit-depot'() { return t("小水果仓"); }, get 'small-sugar-mill'() { return t("小糖厂"); }, get 'large-fruit-depot'() { return t("大水果仓"); }, get 'large-sugar-mill'() { return t("大糖厂"); },
  get 'large-tobacco-storage'() { return t("烟草厂"); }, get 'large-coffee-roaster'() { return t("咖啡烘焙厂"); }, get 'small-market'() { return t("小市场"); }, get hacienda() { return t("大庄园"); },
  get 'builders-yard'() { return t("建筑工场"); }, get 'small-warehouse'() { return t("小仓库"); }, get hospital() { return t("医院"); }, get office() { return t("办事处"); }, get 'large-market'() { return t("大市场"); },
  get 'large-warehouse'() { return t("大仓库"); }, get factory() { return t("工厂"); }, get school() { return t("学校"); }, get harbor() { return t("港口"); }, get wharf() { return t("码头"); },
  get 'fire-station'() { return t("消防站"); }, get residence() { return t("官邸"); }, get fortress() { return t("堡垒"); }, get 'customs-house'() { return t("海关"); }, get 'city-hall'() { return t("市政厅"); },
};
export const PHASE: Record<PlayerView['phase']['kind'], string> = {
  get 'role-selection'() { return t("选择角色"); }, get 'planter-before'() { return t("种植（大庄园）"); }, get 'planter-choice'() { return t("种植"); }, get 'planter-worker'() { return t("种植（医院）"); },
  get 'recruiter-advantage'() { return t("招募特权"); }, get 'recruiter-distribution'() { return t("分发工人"); }, get 'recruiter-placement'() { return t("分配工人"); }, get 'builder-choice'() { return t("建造"); },
  get 'craftsman-production'() { return t("生产"); }, get 'craftsman-bonus'() { return t("工匠特权"); }, get 'trader-choice'() { return t("交易"); }, get 'captain-loading'() { return t("装船"); },
  get 'captain-retention'() { return t("保留货物"); }, get adventurer() { return t("冒险者"); }, get 'phase-completion'() { return t("阶段结算"); }, get 'round-completion'() { return t("回合结算"); }, get 'game-over'() { return t("游戏结束"); },
};
export const END_REASON: Record<EndTrigger['reason'], string> = { get 'worker-shortage'() { return t("工人不足"); }, get 'city-full'() { return t("城市建满"); }, get 'vp-exhausted'() { return t("分数用尽"); } };
