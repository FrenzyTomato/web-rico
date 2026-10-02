import { t, useLanguage } from '../i18n/language.js';
import type { PublicPlayerView } from '@vibe-rico/protocol';
import type { useBoardActions } from './useBoardActions.js';
import { BUILDING, TILE } from '../i18n/terms.js';

/** Keyboard equivalents share the exact draft used by the 3D pieces. */
export function WorkerControls({ board, player }: { board: ReturnType<typeof useBoardActions>; player: PublicPlayerView }) {
  useLanguage();
  if (!board.placement || !board.draft) return null;
  const name = (id: string) => {
    const tile = player.countryside.find(t => t.instanceId === id);
    const building = player.buildings.find(b => b.instanceId === id);
    return tile ? TILE[tile.kind] : building ? BUILDING[building.buildingTypeId] : id;
  };
  return <div aria-label={t("分配工人")}>
    <p role="status">{board.draft.holding ? t("已选工人：点击田园或建筑放置；点击工人池可放回。") : t("点击工人，再点击田园或建筑。已分配的工人也可移动。")}{t("（分配预览，确认后提交）")}</p>
    <button disabled={!board.canConfirm} onClick={board.confirm}>{t("确认分配")}</button>
    <button onClick={board.reset}>{t("重置分配")}</button>
    <details><summary>{t("键盘分配工人")}</summary>
      <button disabled={!board.actionable({ kind: 'worker', id: 'pool', index: 0 })} onClick={() => board.draft?.holding ? board.clear() : board.select({ kind: 'worker', id: 'pool', index: 0 })}>{t("选择／放回池中工人")}</button>
      {board.placement.slots.map(s => <span key={s.instanceId}>
        <button disabled={!board.actionable({ kind: s.kind === 'countryside' ? 'tile' : 'owned-building', id: s.instanceId })}
          onClick={() => board.select({ kind: s.kind === 'countryside' ? 'tile' : 'owned-building', id: s.instanceId })}>
          {name(s.instanceId)} {board.draft!.counts[s.instanceId]}/{s.capacity}{t(" 放置")}</button>
        <button disabled={!board.actionable({ kind: 'worker', id: s.instanceId, index: 0 })}
          onClick={() => board.select({ kind: 'worker', id: s.instanceId, index: 0 })}>{name(s.instanceId)}{t(" 取回工人")}</button>
      </span>)}
    </details>
  </div>;
}
