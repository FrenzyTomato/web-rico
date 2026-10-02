import { t } from './language.js';
import type { PlayerEvent } from '@vibe-rico/protocol';
import { BUILDING, END_REASON, GOOD, ROLE, TILE } from './terms.js';

/** One readable chronicle line per player-visible event; bookkeeping events (phase changes) are skipped. */
export function describeEvent(e: PlayerEvent, names: Readonly<Record<string, string>>): string | null {
  const who = (id: string) => names[id] ?? id;
  switch (e.kind) {
    case 'role-selected': return t("{0} 选择了{1}", [who(e.playerId), ROLE[e.role]]);
    case 'coins-changed': return t("{0} 金币 {1}{2}", [who(e.playerId), e.delta > 0 ? '+' : '', e.delta]);
    case 'tile-placed': return t("{0} 获得{1}", [who(e.playerId), TILE[e.tile.kind]]);
    case 'building-built': return t("{0} 建造了{1}", [who(e.playerId), BUILDING[e.building.buildingTypeId]]);
    case 'workers-received': return t("{0} 获得 {1} 名工人", [who(e.playerId), e.quantity]);
    case 'vp-earned': return t("你获得 {0} 分", [e.quantity]);
    case 'end-triggered': return t("游戏将在本阶段后结束：{0}", [END_REASON[e.trigger.reason]]);
    case 'game-scored': return t("游戏结束，最终计分已公布");
    case 'goods-moved': {
      const goods = `${GOOD[e.good]}×${e.quantity}`;
      if (e.from.kind === 'supply' && e.to.kind === 'player') return t("{0} 获得{1}", [who(e.to.playerId), goods]);
      if (e.from.kind === 'player' && (e.to.kind === 'cargo-ship' || e.to.kind === 'personal-ship')) return t("{0} 装运{1}", [who(e.from.playerId), goods]);
      if (e.from.kind === 'player' && e.to.kind === 'trading-house') return t("{0} 出售{1}", [who(e.from.playerId), GOOD[e.good]]);
      if (e.from.kind === 'player' && e.to.kind === 'supply') return t("{0} 丢弃{1}", [who(e.from.playerId), goods]);
      return null;
    }
    default: return null;
  }
}
