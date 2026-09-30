import type { PlayerEvent } from '@vibe-rico/protocol';
import { BUILDING, END_REASON, GOOD, ROLE, TILE } from './terms.js';

/** One readable chronicle line per player-visible event; bookkeeping events (phase changes) are skipped. */
export function describeEvent(e: PlayerEvent, names: Readonly<Record<string, string>>): string | null {
  const who = (id: string) => names[id] ?? id;
  switch (e.kind) {
    case 'role-selected': return `${who(e.playerId)} 选择了${ROLE[e.role]}`;
    case 'coins-changed': return `${who(e.playerId)} 金币 ${e.delta > 0 ? '+' : ''}${e.delta}`;
    case 'tile-placed': return `${who(e.playerId)} 获得${TILE[e.tile.kind]}`;
    case 'building-built': return `${who(e.playerId)} 建造了${BUILDING[e.building.buildingTypeId]}`;
    case 'workers-received': return `${who(e.playerId)} 获得 ${e.quantity} 名工人`;
    case 'vp-earned': return `你获得 ${e.quantity} 分`;
    case 'end-triggered': return `游戏将在本阶段后结束：${END_REASON[e.trigger.reason]}`;
    case 'game-scored': return '游戏结束，最终计分已公布';
    case 'goods-moved': {
      const goods = `${GOOD[e.good]}×${e.quantity}`;
      if (e.from.kind === 'supply' && e.to.kind === 'player') return `${who(e.to.playerId)} 获得${goods}`;
      if (e.from.kind === 'player' && (e.to.kind === 'cargo-ship' || e.to.kind === 'personal-ship')) return `${who(e.from.playerId)} 装运${goods}`;
      if (e.from.kind === 'player' && e.to.kind === 'trading-house') return `${who(e.from.playerId)} 出售${GOOD[e.good]}`;
      if (e.from.kind === 'player' && e.to.kind === 'supply') return `${who(e.from.playerId)} 丢弃${goods}`;
      return null;
    }
    default: return null;
  }
}
