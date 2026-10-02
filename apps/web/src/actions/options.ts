import { t } from '../i18n/language.js';
import type { Good, LegalAction } from '@vibe-rico/game-engine';
import type { GameplayRequest, PlayerView } from '@vibe-rico/protocol';
import { BUILDING, GOOD, ROLE, TILE } from '../i18n/terms.js';

export type Action = GameplayRequest['action'];
export interface Option { readonly label: string; readonly action: Action }
export const GOODS: readonly Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];
const yesNo = (accept: boolean) => (accept ? t("是") : t("否"));

/**
 * Discrete choices, taken one-for-one from the engine's descriptor; the UI adds no rules of its own.
 * Worker allocation and goods retention are constrained forms (null here; see the form components).
 */
export function describeOptions(legal: LegalAction, view: Pick<PlayerView, 'roleCards' | 'estateMarket' | 'players'>): Option[] | null {
  const tileKind = (id: string) => TILE[(view.estateMarket.find(t => t.instanceId === id) ?? view.players.flatMap(p => p.countryside).find(t => t.instanceId === id))!.kind];
  const a = (action: unknown) => action as Action;
  switch (legal.phase) {
    case 'role-selection':
      return legal.roleCardIds.map((id, index) => {
        const card = view.roleCards.find(c => c.instanceId === id)!;
        // Numeric positions distinguish duplicate Adventurer cards without exposing engine IDs.
        return { label: t("选择角色 {0}（{1} 金币，序号 {2}）", [ROLE[card.kind], card.accumulatedCoins, index + 1]), action: a({ kind: 'choose-role', roleCardId: id }) };
      });
    case 'planter-before': return legal.accept.map(accept => ({ label: t("使用{0}：{1}", [BUILDING.hacienda, yesNo(accept)]), action: a({ kind: 'use-hacienda', accept }) }));
    case 'planter-choice':
      return legal.choices.map(choice => ({ label: choice.kind === 'estate' ? t("种植 {0}（序号 {1}）", [tileKind(choice.tileId), view.estateMarket.findIndex(tile => tile.instanceId === choice.tileId) + 1]) : choice.kind === 'quarry' ? t("取采石场") : t("放弃"),
        action: a({ kind: 'plant', choice }) }));
    case 'planter-worker':
      return legal.tileIds.map((tileId, index) => ({ label: tileId === null ? t("不使用{0}", [BUILDING.hospital]) : t("{0}工人放到 {1}（序号 {2}）", [BUILDING.hospital, tileKind(tileId), index + 1]), action: a({ kind: 'use-hospital', tileId }) }));
    case 'recruiter-advantage': return legal.accept.map(accept => ({ label: t("领取额外工人：{0}", [yesNo(accept)]), action: a({ kind: 'recruit-worker', accept }) }));
    case 'builder-choice':
      return [
        ...legal.purchases.flatMap(p => p.schoolChoices.map(useSchool => ({
          label: t("建造 {0}（{1} 金币{2}{3}）", [BUILDING[p.buildingTypeId], p.price, p.useAdvantage ? t("，使用建筑师特权") : '', useSchool ? t("，使用{0}", [BUILDING.school]) : '']),
          action: a({ kind: 'build', purchase: { buildingTypeId: p.buildingTypeId, useAdvantage: p.useAdvantage, useSchool } }) }))),
        { label: t("不建造"), action: a({ kind: 'build', purchase: null }) },
      ];
    case 'craftsman-production':
      return [
        ...legal.factoryChoices.map(useFactory => ({
          label: t("生产 {0}{1}", [GOODS.filter(g => legal.output[g] > 0).map(g => `${GOOD[g]}×${legal.output[g]}`).join(' ') || t("（无产出）"), useFactory ? t("，使用{0}", [BUILDING.factory]) : '']),
          action: a({ kind: 'produce', production: { accept: true, useFactory } }) })),
        { label: t("放弃生产"), action: a({ kind: 'produce', production: { accept: false } }) },
      ];
    case 'craftsman-bonus':
      return legal.goods.map(good => ({ label: good === null ? t("不取额外货物") : t("额外货物 {0}", [GOOD[good]]), action: a({ kind: 'take-production-bonus', good }) }));
    case 'trader-choice':
      return [
        ...legal.sales.map(s => ({
          label: t("出售 {0}（{1} 金币{2}{3}{4}）", [GOOD[s.good], s.price, s.useAdvantage ? t("，商人特权") : '', s.useSmallMarket ? `，${BUILDING['small-market']}` : '', s.useLargeMarket ? `，${BUILDING['large-market']}` : '']),
          action: a({ kind: 'trade', sale: { good: s.good, useAdvantage: s.useAdvantage, useSmallMarket: s.useSmallMarket, useLargeMarket: s.useLargeMarket } }) })),
        { label: t("不出售"), action: a({ kind: 'trade', sale: null }) },
      ];
    case 'captain-loading':
      return [
        ...legal.loads.flatMap(l => legal.harborChoices.map(useHarbor => ({
          label: t("装运 {0}×{1} 到 {2}{3}", [GOOD[l.shipment.good], l.quantity, l.shipment.kind === 'cargo' ? t('货船 {0}', [l.shipment.shipId.replace(/\D/g, '') || 1]) : t("私人船"), useHarbor ? t("，使用{0}", [BUILDING.harbor]) : '']),
          action: a({ kind: 'load', shipment: l.shipment, useHarbor }) }))),
        ...(legal.canDeclineWharf ? [{ label: t("不使用{0}", [BUILDING.wharf]), action: a({ kind: 'decline-wharf' }) }] : []),
      ];
    case 'adventurer': return legal.accept.map(accept => ({ label: t("领取 1 金币：{0}", [yesNo(accept)]), action: a({ kind: 'take-adventurer-coin', accept }) }));
    case 'recruiter-placement':
    case 'captain-retention':
      return null;
  }
}
