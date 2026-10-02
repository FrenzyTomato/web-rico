import { t } from './language.js';

/** Shared command-tile descriptions for tooltips and settings help. */
export const ROLE_HELP = {
  get planter() { return t("每人可取一块种植园；选择者也可改取采石场"); },
  get recruiter() { return t("分发工人，并把工人分配到种植园和建筑"); },
  get builder() { return t("每人可建造一栋建筑；选择者便宜 1 金币，采石场再降价"); },
  get craftsman() { return t("有工人的种植园和生产建筑产出货物；选择者另得 1 个"); },
  get trader() { return t("每人可向交易所卖出一种货物；选择者多得 1 金币"); },
  get captain() { return t("依次把货物装上货船换取分数，最后多余货物需丢弃"); },
  get adventurer() { return t("选择者获得 1 金币（4–5 人游戏）"); },
};
