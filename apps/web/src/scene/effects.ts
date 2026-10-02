import { t } from '../i18n/language.js';
import { BUILDINGS } from '@vibe-rico/game-engine';
import type { BuildingType, CountrysideTile } from '@vibe-rico/game-engine';
import { BUILDING, TILE } from '../i18n/terms.js';

/** Concise summaries of docs/RULES.md BUILDING-001–023; eligibility remains server-owned. */
export const BUILDING_EFFECT: Record<BuildingType, string> = {
  get 'small-fruit-depot'() { return t("有工人且有已启用的香蕉田园时，最多生产一箱香蕉。"); },
  get 'small-sugar-mill'() { return t("有工人且有已启用的甘蔗田园时，最多生产一箱糖。"); },
  get 'large-fruit-depot'() { return t("最多生产三箱香蕉，数量受已分配工人及已启用香蕉田园数量限制。"); },
  get 'large-sugar-mill'() { return t("最多生产三箱糖，数量受已分配工人及已启用甘蔗田园数量限制。"); },
  get 'large-tobacco-storage'() { return t("最多生产三箱烟草，数量受已分配工人及已启用烟草田园数量限制；此建筑不能储存货物。"); },
  get 'large-coffee-roaster'() { return t("最多生产两箱咖啡，数量受已分配工人及已启用咖啡田园数量限制。"); },
  get 'small-market'() { return t("成功出售货物时，可额外获得一枚金币，可与大市场及商人特权叠加。"); },
  get 'large-market'() { return t("成功出售货物时，可额外获得两枚金币，可与小市场及商人特权叠加。"); },
  get hacienda() { return t("正常种植前，可随机抽取一块背面朝上的田园并放入空位。不能拒绝该田园或改取采石场。"); },
  get 'builders-yard'() { return t("正常种植时，可用采石场代替公开田园。不改变大庄园的抽取规则。"); },
  get 'small-warehouse'() { return t("强制装船后，可保留一种货物的所有剩余货箱，以及正常可保留的单个货箱。可与大仓库叠加。"); },
  get 'large-warehouse'() { return t("强制装船后，可保留两种货物的所有剩余货箱，以及正常可保留的单个货箱。可与小仓库叠加。"); },
  get hospital() { return t("你的种植回合中，可为一块新获得的田园或采石场添加一名工人。即使使用大庄园，也只能添加一名。先从储备领取，不足时从招募区领取。"); },
  get office() { return t("可出售交易所已有的货物类型。仍只能出售一箱，且交易所必须有空位。"); },
  get factory() { return t("实际生产了二／三／四／五种货物后，可获得一／二／三／五枚金币。旧库存及特权所得货物不计入。"); },
  get school() { return t("若学校已启用，可为新购买的建筑添加一名工人。先从储备领取，不足时从招募区领取；两处都空时不能领取。"); },
  get harbor() { return t("每次装运至少一箱货物时，可额外获得一分，包括使用私人船的装运。"); },
  get wharf() { return t("每个船长阶段一次，可用私人船装运你持有的某一种货物的全部货箱。货物留在船上直到清理阶段。"); },
  get 'fire-station'() { return t("终局时若已启用：每栋自有小型生产建筑加一分，每栋大型生产建筑加两分，无论这些生产建筑是否有工人。"); },
  get residence() { return t("终局时若已启用：拥有一至九／十／十一／十二块田园时，获得四／五／六／七分。采石场也计入，这些田园不必有工人。"); },
  get fortress() { return t("终局时若已启用：每拥有三名工人加一分，包含空闲工人，向下取整。"); },
  get 'customs-house'() { return t("终局时若已启用：每四分运货分加一分，向下取整。建筑分不计入。"); },
  get 'city-hall'() { return t("终局时若已启用：每栋自有商业建筑加一分，包含市政厅本身。大型建筑只算一栋。"); },
};
export const ESTATE_EFFECT: Record<CountrysideTile['kind'], string> = {
  get corn() { return t("每块有工人的玉米田园生产一箱玉米，不需要生产建筑，受公共货物供应限制。"); },
  get fruit() { return t("每块有工人的香蕉田园可支持生产一箱香蕉，还需水果仓的工人位已启用且供应充足。"); },
  get sugar() { return t("每块有工人的甘蔗田园可支持生产一箱糖，还需糖厂的工人位已启用且供应充足。"); },
  get tobacco() { return t("每块有工人的烟草田园可支持生产一箱烟草，还需烟草仓库的工人位已启用且供应充足。"); },
  get coffee() { return t("每块有工人的咖啡田园可支持生产一箱咖啡，还需咖啡烘焙厂的工人位已启用且供应充足。"); },
  get quarry() { return t("有工人的采石场可使建造费用减少一枚金币，最多使用该建筑允许的采石场数量。费用不能低于零。"); },
};
export interface PieceHint { title: string; detail: string; meta: string }
export function buildingHint(type: BuildingType): PieceHint {
  const b = BUILDINGS[type];
  return { title: BUILDING[type], detail: BUILDING_EFFECT[type], meta: t('费用 {0} 金币 · 基础分 {1} · 工人位 {2} · 占地 {3} 格。能力需要工人才能启用。', [b.cost, b.baseVp, b.workerSlots, b.footprint]) };
}
export function estateHint(type: CountrysideTile['kind']): PieceHint {
  return { title: TILE[type], detail: ESTATE_EFFECT[type], meta: t('占用一格田园 · 一个工人位') };
}
