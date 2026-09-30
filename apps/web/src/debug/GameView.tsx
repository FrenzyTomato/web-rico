import { useStore } from 'zustand';
import type { Goods } from '@vibe-rico/game-engine';
import type { CommandRejected, PlayerView, RoomState } from '@vibe-rico/protocol';
import { ActionForm } from '../actions/ActionForm.js';
import type { GameStore } from '../state/gameStore.js';
import { ScoreView } from './ScoreView.js';
import { BUILDING, END_REASON, GOOD, PHASE, ROLE, TILE } from '../i18n/terms.js';

const goods = (g: Goods) => (Object.entries(g) as [keyof Goods, number][]).filter(([, n]) => n > 0).map(([k, n]) => `${GOOD[k]}×${n}`).join(' ') || '无';

/** Debug rendering of every PlayerView field: shared areas, every seat's public resources, and the viewer's VP. */
export function GameView({ view, names }: { view: PlayerView; names: Readonly<Record<string, string>> }) {
  const name = (id: string | null) => (id === null ? '—' : names[id] ?? id);
  const phase = view.phase;
  return (
    <div>
      <section aria-label="回合">
        <p>第 {view.roundNumber} 轮 · 总督 {name(view.governorPlayerId)} · 阶段 {PHASE[phase.kind]}
          {'actorId' in phase && ` · 等待 ${name(phase.actorId)}`}</p>
        <p>我的运货分：{view.viewer.earnedVp}</p>
        {view.endTriggers.length > 0 && <p>游戏将在本阶段后结束：{view.endTriggers.map(t => END_REASON[t.reason]).join('、')}</p>}
      </section>
      <section aria-label="角色">
        <ul>{view.roleCards.map(c => <li key={c.instanceId}>{ROLE[c.kind]}：{c.accumulatedCoins} 金币{c.selectedBy && `（${name(c.selectedBy)}）`}</li>)}</ul>
      </section>
      <section aria-label="公共区域">
        <p>货物供应：{goods(view.supply.goods)}</p>
        <p>工人供应 {view.supply.workerCount} · 殖民船 {view.supply.workRegisterCount} · 采石场 {view.supply.quarryCount} · 剩余分数 {view.supply.vpRemaining}（超出 {view.supply.vpOverflow}）</p>
        <p>种植园市场：{view.estateMarket.map(t => `${TILE[t.kind]}（${t.instanceId}）`).join('、') || '空'} · 弃牌 {view.estateDiscard.length}</p>
        <p>建筑市场：{(Object.entries(view.supply.buildingStock) as [keyof typeof BUILDING, number][]).filter(([, n]) => n > 0).map(([b, n]) => `${BUILDING[b]}×${n}`).join('、')}</p>
        <p>货船：{view.ships.map(s => `${s.instanceId}[${s.capacity}] ${s.goodType ? GOOD[s.goodType] : '空'} ${s.loadedCount}/${s.capacity}`).join(' · ')}</p>
        <p>交易所：{view.tradingHouse.map(g => GOOD[g]).join('、') || '空'}（{view.tradingHouse.length}/4）</p>
      </section>
      <section aria-label="玩家">
        {view.players.map(p => (
          <article key={p.playerId} aria-label={name(p.playerId)}>
            <h3>{name(p.playerId)}{p.playerId === view.viewer.playerId && '（你）'}</h3>
            <p>金币 {p.coins} · 货物 {goods(p.goods)} · 空闲工人 {p.idleWorkerCount}{p.personalShip && ` · 私人船 ${p.personalShip.goodType ? GOOD[p.personalShip.goodType] : '空'} ${p.personalShip.loadedCount}`}</p>
            <p>种植园：{p.countryside.map(t => `${TILE[t.kind]}${t.occupied ? '●' : '○'}`).join(' ') || '无'}</p>
            <p>建筑：{p.buildings.map(b => `${BUILDING[b.buildingTypeId]}(${b.occupiedSlots})`).join(' ') || '无'}</p>
          </article>
        ))}
      </section>
      {phase.kind === 'game-over' && <ScoreView scores={phase.scores} names={names} />}
    </div>
  );
}

const REJECTIONS: Partial<Record<CommandRejected['code'], string>> = {
  STALE_REVISION: '状态已更新，请根据最新局面重新选择',
  STALE_SESSION: '此座位已在其他窗口中打开',
  UNAUTHORIZED: '未连接到座位，请刷新',
};
export const rejectionText = (r: CommandRejected) =>
  REJECTIONS[r.code] ?? `操作被拒绝：${r.code}${r.ruleId ? `（规则 ${r.ruleId}）` : ''}`;

/** In-game screen: latest authoritative view, this seat's actions, and the last server rejection. */
export function Game({ store, roomId, room }: { store: GameStore; roomId: string; room: RoomState }) {
  const latest = useStore(store, s => s.latest);
  const rejection = useStore(store, s => s.rejection);
  const connected = useStore(store, s => s.connected);
  if (!latest) return <p>正在载入局面…</p>;
  const names = Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]));
  return (
    <div data-revision={latest.revision}>
      <p>版本 {latest.revision}</p>
      {rejection && <p role="alert">{rejectionText(rejection)}</p>}
      {connected
        ? <ActionForm legalActions={latest.legalActions} view={latest.view} submit={action => store.getState().submit(roomId, action)} />
        : <p>连接已断开，暂时不能行动</p>}
      <GameView view={latest.view} names={names} />
    </div>
  );
}
