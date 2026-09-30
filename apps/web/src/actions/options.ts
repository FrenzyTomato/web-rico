import type { Good, LegalAction } from '@vibe-rico/game-engine';
import type { GameplayRequest, PlayerView } from '@vibe-rico/protocol';
import { BUILDING, GOOD, ROLE, TILE } from '../i18n/terms.js';

export type Action = GameplayRequest['action'];
export interface Option { readonly label: string; readonly action: Action }
export const GOODS: readonly Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];
const yesNo = (accept: boolean) => (accept ? '是' : '否');

/**
 * Discrete choices, taken one-for-one from the engine's descriptor; the UI adds no rules of its own.
 * Worker allocation and goods retention are constrained forms (null here; see the form components).
 */
export function describeOptions(legal: LegalAction, view: Pick<PlayerView, 'roleCards' | 'estateMarket' | 'players'>): Option[] | null {
  const tileKind = (id: string) => TILE[(view.estateMarket.find(t => t.instanceId === id) ?? view.players.flatMap(p => p.countryside).find(t => t.instanceId === id))!.kind];
  const a = (action: unknown) => action as Action;
  switch (legal.phase) {
    case 'role-selection':
      return legal.roleCardIds.map(id => {
        const card = view.roleCards.find(c => c.instanceId === id)!;
        // The card ID keeps labels distinct: 4–5 players have two Adventurer cards.
        return { label: `选择角色 ${ROLE[card.kind]}（${card.accumulatedCoins} 金币，${id}）`, action: a({ kind: 'choose-role', roleCardId: id }) };
      });
    case 'planter-before': return legal.accept.map(accept => ({ label: `使用${BUILDING.hacienda}：${yesNo(accept)}`, action: a({ kind: 'use-hacienda', accept }) }));
    case 'planter-choice':
      return legal.choices.map(choice => ({ label: choice.kind === 'estate' ? `种植 ${tileKind(choice.tileId)}（${choice.tileId}）` : choice.kind === 'quarry' ? '取采石场' : '放弃',
        action: a({ kind: 'plant', choice }) }));
    case 'planter-worker':
      return legal.tileIds.map(tileId => ({ label: tileId === null ? `不使用${BUILDING.hospital}` : `${BUILDING.hospital}工人放到 ${tileKind(tileId)}（${tileId}）`, action: a({ kind: 'use-hospital', tileId }) }));
    case 'recruiter-advantage': return legal.accept.map(accept => ({ label: `领取额外工人：${yesNo(accept)}`, action: a({ kind: 'recruit-worker', accept }) }));
    case 'builder-choice':
      return [
        ...legal.purchases.flatMap(p => p.schoolChoices.map(useSchool => ({
          label: `建造 ${BUILDING[p.buildingTypeId]}（${p.price} 金币${p.useAdvantage ? '，使用建筑师特权' : ''}${useSchool ? `，使用${BUILDING.school}` : ''}）`,
          action: a({ kind: 'build', purchase: { buildingTypeId: p.buildingTypeId, useAdvantage: p.useAdvantage, useSchool } }) }))),
        { label: '不建造', action: a({ kind: 'build', purchase: null }) },
      ];
    case 'craftsman-production':
      return [
        ...legal.factoryChoices.map(useFactory => ({
          label: `生产 ${GOODS.filter(g => legal.output[g] > 0).map(g => `${GOOD[g]}×${legal.output[g]}`).join(' ') || '（无产出）'}${useFactory ? `，使用${BUILDING.factory}` : ''}`,
          action: a({ kind: 'produce', production: { accept: true, useFactory } }) })),
        { label: '放弃生产', action: a({ kind: 'produce', production: { accept: false } }) },
      ];
    case 'craftsman-bonus':
      return legal.goods.map(good => ({ label: good === null ? '不取额外货物' : `额外货物 ${GOOD[good]}`, action: a({ kind: 'take-production-bonus', good }) }));
    case 'trader-choice':
      return [
        ...legal.sales.map(s => ({
          label: `出售 ${GOOD[s.good]}（${s.price} 金币${s.useAdvantage ? '，商人特权' : ''}${s.useSmallMarket ? `，${BUILDING['small-market']}` : ''}${s.useLargeMarket ? `，${BUILDING['large-market']}` : ''}）`,
          action: a({ kind: 'trade', sale: { good: s.good, useAdvantage: s.useAdvantage, useSmallMarket: s.useSmallMarket, useLargeMarket: s.useLargeMarket } }) })),
        { label: '不出售', action: a({ kind: 'trade', sale: null }) },
      ];
    case 'captain-loading':
      return [
        ...legal.loads.flatMap(l => legal.harborChoices.map(useHarbor => ({
          label: `装运 ${GOOD[l.shipment.good]}×${l.quantity} 到 ${l.shipment.kind === 'cargo' ? l.shipment.shipId : '私人船'}${useHarbor ? `，使用${BUILDING.harbor}` : ''}`,
          action: a({ kind: 'load', shipment: l.shipment, useHarbor }) }))),
        ...(legal.canDeclineWharf ? [{ label: `不使用${BUILDING.wharf}`, action: a({ kind: 'decline-wharf' }) }] : []),
      ];
    case 'adventurer': return legal.accept.map(accept => ({ label: `领取 1 金币：${yesNo(accept)}`, action: a({ kind: 'take-adventurer-coin', accept }) }));
    case 'recruiter-placement':
    case 'captain-retention':
      return null;
  }
}
