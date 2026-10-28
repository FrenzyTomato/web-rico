import { t, useLanguage } from '../i18n/language.js';
import { useState } from 'react';
import type { Good, LegalAction } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';
import { describeOptions, GOODS } from './options.js';
import type { Action } from './options.js';
import { GOOD } from '../i18n/terms.js';

export { describeOptions } from './options.js';

function AllocationForm({ legal, submit }: { legal: Extract<LegalAction, { phase: 'recruiter-placement' }>; submit: (a: Action) => void }) {
  useLanguage();
  const [counts, setCounts] = useState<number[]>(() => legal.slots.map(() => 0));
  const placed = counts.reduce((a, b) => a + b, 0);
  const action = {
    kind: 'allocate-workers',
    allocation: {
      countryside: legal.slots.flatMap((s, i) => s.kind === 'countryside' ? [{ tileId: s.instanceId, occupied: counts[i] === 1 }] : []),
      buildings: legal.slots.flatMap((s, i) => s.kind === 'building' ? [{ buildingId: s.instanceId, occupiedSlots: counts[i]! }] : []),
      idleCount: legal.totalWorkers - placed,
    },
  } as unknown as Action;
  return (
    <form aria-label={t("分配工人")} onSubmit={e => { e.preventDefault(); submit(action); }}>
      <p>{t('共 {0} 名工人；空闲 {1}（所有位置填满前不能空闲）', [legal.totalWorkers, legal.totalWorkers - placed])}</p>
      {legal.slots.map((s, i) => (
        <label key={s.instanceId}>{t('{0}（最多 {1}）', [t('第 {0} 格', [i + 1]), s.capacity])}
          <input type="number" min={0} max={s.capacity} value={counts[i]}
            onChange={e => setCounts(c => c.map((n, j) => (j === i ? Number(e.target.value) : n)))} />
        </label>
      ))}
      <button type="submit">{t("确认分配")}</button>
    </form>
  );
}

function RetentionForm({ legal, submit }: { legal: Extract<LegalAction, { phase: 'captain-retention' }>; submit: (a: Action) => void }) {
  useLanguage();
  const [kept, setKept] = useState<Record<Good, number>>({ corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 });
  const [warehouse, setWarehouse] = useState<Good[]>([]);
  const owned = GOODS.filter(g => legal.available[g] > 0);
  return (
    <form aria-label={t("保留货物")} onSubmit={e => { e.preventDefault(); submit({ kind: 'retain', retained: kept, warehouseTypes: warehouse } as Action); }}>
      <p>{t('仓库可保护 {0} 种货物，另可保留 {1} 个其他货物', [legal.maxWarehouseTypes, legal.extraSingleCrates])}</p>
      {owned.map(g => (
        <fieldset key={g}>
          {/* − / + steppers instead of a number field: phones' keyboards made "1" type as "01". */}
          <div className="keep-stepper" role="group" aria-label={t('{0} 保留（共 {1}）', [GOOD[g], legal.available[g]])}>
            <span>{t('{0} 保留（共 {1}）', [GOOD[g], legal.available[g]])}</span>
            <button type="button" aria-label={t('少保留一个{0}', [GOOD[g]])} disabled={kept[g] <= 0} onClick={() => setKept(k => ({ ...k, [g]: k[g] - 1 }))}>−</button>
            <output aria-live="polite">{kept[g]}</output>
            <button type="button" aria-label={t('多保留一个{0}', [GOOD[g]])} disabled={kept[g] >= legal.available[g]} onClick={() => setKept(k => ({ ...k, [g]: k[g] + 1 }))}>+</button>
          </div>
          {legal.maxWarehouseTypes > 0 && (
            <label><input type="checkbox" checked={warehouse.includes(g)}
              onChange={e => setWarehouse(w => e.target.checked ? [...w, g] : w.filter(x => x !== g))} />{t("仓库保护 ")}{GOOD[g]}</label>
          )}
        </fieldset>
      ))}
      <button type="submit">{t("确认保留")}</button>
    </form>
  );
}

/** Controls for this seat's legal actions only; the server validates every submission. */
export function ActionForm({ legalActions, view, submit, boardFirst = false, allow = () => true }: {
  legalActions: readonly LegalAction[]; view: Pick<PlayerView, 'roleCards' | 'estateMarket' | 'players'> & { phase?: PlayerView['phase'] }; submit: (action: Action) => void;
  boardFirst?: boolean;
  /** Hides options outside a guided move. */
  allow?: ((action: Action) => boolean) | undefined;
}) {
  useLanguage();
  const legal = legalActions[0];
  if (!legal) return <p>{view.phase?.kind === 'game-over' ? t("游戏结束") : t("等待其他玩家行动…")}</p>;
  if (legal.phase === 'recruiter-placement') return <AllocationForm key={JSON.stringify(legal)} legal={legal} submit={submit} />;
  if (legal.phase === 'captain-retention') return <RetentionForm key={JSON.stringify(legal)} legal={legal} submit={submit} />;
  if (boardFirst && (legal.phase === 'builder-choice' || legal.phase === 'planter-choice')) {
    const options = describeOptions(legal, view)!.filter(o => allow(o.action));
    const declines = options.filter(o => o.action.kind === 'build' ? o.action.purchase === null : o.action.kind === 'plant' && o.action.choice.kind === 'decline');
    const choices = options.filter(o => !declines.includes(o));
    return <div className="board-choice-guide">
      <p role="status">{choices.length === 0 ? t('当前没有可选对象，请跳过此行动。') : legal.phase === 'builder-choice'
        ? t('点击中央建筑市场中带描边的建筑，再确认建造。') : t('点击中央公共区中带描边的田园或采石场，再确认选择。')}</p>
      {declines.map(o => <button key={o.label} onClick={() => submit(o.action)}>{o.label}</button>)}
      {choices.length > 0 && <details><summary>{t('键盘选择')}</summary><div role="group" aria-label={t('可选行动')}>
        {choices.map(o => <button key={JSON.stringify(o.action)} onClick={() => submit(o.action)}>{o.label}</button>)}
      </div></details>}
    </div>;
  }
  return (
    <div role="group" aria-label={t("可选行动")}>
      {describeOptions(legal, view)!.filter(o => allow(o.action)).map(o => <button key={JSON.stringify(o.action)} onClick={() => submit(o.action)}>{o.label}</button>)}
    </div>
  );
}
