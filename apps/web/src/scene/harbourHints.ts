import type { CargoShip, Good } from '@vibe-rico/game-engine';
import { t } from '../i18n/language.js';
import { GOOD } from '../i18n/terms.js';
import type { PieceHint } from './effects.js';

export function boatHint(ship: CargoShip): PieceHint {
  return {
    title: t('货船 · {0} 格', [ship.capacity]),
    detail: t('每船只装一种货物，同种货物不能分装到其他货船。每箱获得 1 分；船长选择者首次装运额外获得 1 分。满船在船长阶段结束时清空。'),
    meta: t('货物：{0} · 已装 {1}/{2} · 空位 {3}', [ship.goodType ? GOOD[ship.goodType] : t('空船'), ship.loadedCount, ship.capacity, ship.capacity - ship.loadedCount]),
  };
}
export function depotHint(goods: readonly Good[]): PieceHint {
  return {
    title: t('交易所'),
    detail: t('商人阶段每人最多卖出一箱，换取金币而非分数。最多容纳 4 箱；通常不能出售已有种类，启用的办事处可例外。装满后在商人阶段结束时清空。'),
    meta: t('已存 {0}/4：{1}', [goods.length, goods.length ? goods.map(g => GOOD[g]).join(' · ') : t('空')]),
  };
}
