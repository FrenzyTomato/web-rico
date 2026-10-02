import { t, useLanguage } from '../i18n/language.js';
import type { Goods } from '@vibe-rico/game-engine';
import type { CommandRejected, PlayerView } from '@vibe-rico/protocol';
import { BUILDING, END_REASON, GOOD, PHASE, ROLE, TILE } from '../i18n/terms.js';

const goods = (g: Goods) => (Object.entries(g) as [keyof Goods, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${GOOD[k]}×${n}`).join(' ') || t("无");

/** Debug rendering of every PlayerView field: shared areas, every seat's public resources, and the viewer's VP. */
export function GameView({ view, names }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  useLanguage();
  const name = (id: string | null) => (id === null ? '—' : names[id] ?? id);
  const phase = view.phase;
  return (
    <div>
      <section aria-label={t("回合")}>
        <p>{t("第 ")}{view.roundNumber}{t(" 轮 · 总督 ")}{name(view.governorPlayerId)}{t(" · 阶段 ")}{PHASE[phase.kind]}
          {'actorId' in phase && t(" · 等待 {0}", [name(phase.actorId)])}</p>
        <p>{t("我的运货分：")}{view.viewer.earnedVp}</p>
        {view.endTriggers.length > 0 && <p>{t("游戏将在本阶段后结束：")}{view.endTriggers.map(t => END_REASON[t.reason]).join('、')}</p>}
      </section>
      <section aria-label={t("角色")}>
        <ul>{view.roleCards.map(c => <li key={c.instanceId}>{ROLE[c.kind]}：{c.accumulatedCoins}{t(" 金币")}{c.selectedBy && `（${name(c.selectedBy)}）`}</li>)}</ul>
      </section>
      <section aria-label={t("公共区域")}>
        <p>{t("货物供应：")}{goods(view.supply.goods)}</p>
        <p>{t("工人供应 ")}{view.supply.workerCount}{t(" · 殖民船 ")}{view.supply.workRegisterCount}{t(" · 采石场 ")}{view.supply.quarryCount}{t(" · 剩余分数 ")}{view.supply.vpRemaining}{t("（超出 ")}{view.supply.vpOverflow}）</p>
        <p>{t("种植园市场：")}{view.estateMarket.map(t => TILE[t.kind]).join('、') || t("空")}{t(" · 弃牌 ")}{view.estateDiscard.length}</p>
        <p>{t("建筑市场：")}{(Object.entries(view.supply.buildingStock) as [keyof typeof BUILDING, number][]).filter(([, n]) => n > 0).map(([b, n]) => `${BUILDING[b]}×${n}`).join('、')}</p>
        <p>{t("货船：")}{view.ships.map((s, i) => `${t('货船 {0}', [i + 1])}[${s.capacity}] ${s.goodType ? GOOD[s.goodType] : t("空")} ${s.loadedCount}/${s.capacity}`).join(' · ')}</p>
        <p>{t("交易所：")}{view.tradingHouse.map(g => GOOD[g]).join('、') || t("空")}（{view.tradingHouse.length}/4）</p>
      </section>
      <section aria-label={t("玩家")}>
        {view.players.map(p => (
          <article key={p.playerId} aria-label={name(p.playerId)}>
            <h3>{name(p.playerId)}{p.playerId === view.viewer.playerId && t("（你）")}</h3>
            <p>{t("金币 ")}{p.coins}{t(" · 货物 ")}{goods(p.goods)}{t(" · 空闲工人 ")}{p.idleWorkerCount}{p.personalShip && t(" · 私人船 {0} {1}", [p.personalShip.goodType ? GOOD[p.personalShip.goodType] : t("空"), p.personalShip.loadedCount])}</p>
            <p>{t("种植园：")}{p.countryside.map(t => `${TILE[t.kind]}${t.occupied ? '●' : '○'}`).join(' ') || t("无")}</p>
            <p>{t("建筑：")}{p.buildings.map(b => `${BUILDING[b.buildingTypeId]}(${b.occupiedSlots})`).join(' ') || t("无")}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

const REJECTIONS: Partial<Record<CommandRejected['code'], string>> = {
  get STALE_REVISION() { return t("状态已更新，请根据最新局面重新选择"); },
  get STALE_SESSION() { return t("此座位已在其他窗口中打开"); },
  get UNAUTHORIZED() { return t("未连接到座位，请刷新"); },
};
export const rejectionText = (r: CommandRejected) =>
  REJECTIONS[r.code] ?? t(r.code === 'ILLEGAL_COMMAND' ? '操作不符合当前规则，请重新选择' : r.code === 'BAD_SCHEMA' ? '请求格式无效，请刷新后重试' : '操作失败，请重试');
