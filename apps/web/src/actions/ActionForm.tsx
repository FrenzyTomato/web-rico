import { useState } from 'react';
import type { Good, LegalAction } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';
import { describeOptions, GOODS } from './options.js';
import type { Action } from './options.js';
import { GOOD } from '../i18n/terms.js';

export { describeOptions } from './options.js';

function AllocationForm({ legal, submit }: { legal: Extract<LegalAction, { phase: 'recruiter-placement' }>; submit: (a: Action) => void }) {
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
    <form aria-label="分配工人" onSubmit={e => { e.preventDefault(); submit(action); }}>
      <p>共 {legal.totalWorkers} 名工人；空闲 {legal.totalWorkers - placed}（所有位置填满前不能空闲）</p>
      {legal.slots.map((s, i) => (
        <label key={s.instanceId}>{s.instanceId}（最多 {s.capacity}）
          <input type="number" min={0} max={s.capacity} value={counts[i]}
            onChange={e => setCounts(c => c.map((n, j) => (j === i ? Number(e.target.value) : n)))} />
        </label>
      ))}
      <button type="submit">确认分配</button>
    </form>
  );
}

function RetentionForm({ legal, submit }: { legal: Extract<LegalAction, { phase: 'captain-retention' }>; submit: (a: Action) => void }) {
  const [kept, setKept] = useState<Record<Good, number>>({ corn: 0, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 });
  const [warehouse, setWarehouse] = useState<Good[]>([]);
  const owned = GOODS.filter(g => legal.available[g] > 0);
  return (
    <form aria-label="保留货物" onSubmit={e => { e.preventDefault(); submit({ kind: 'retain', retained: kept, warehouseTypes: warehouse } as Action); }}>
      <p>仓库可保护 {legal.maxWarehouseTypes} 种货物，另可保留 {legal.extraSingleCrates} 个其他货物</p>
      {owned.map(g => (
        <fieldset key={g}>
          <label>{GOOD[g]} 保留（共 {legal.available[g]}）
            <input type="number" min={0} max={legal.available[g]} value={kept[g]} onChange={e => setKept(k => ({ ...k, [g]: Number(e.target.value) }))} />
          </label>
          {legal.maxWarehouseTypes > 0 && (
            <label><input type="checkbox" checked={warehouse.includes(g)}
              onChange={e => setWarehouse(w => e.target.checked ? [...w, g] : w.filter(x => x !== g))} />仓库保护 {GOOD[g]}</label>
          )}
        </fieldset>
      ))}
      <button type="submit">确认保留</button>
    </form>
  );
}

/** Controls for this seat's legal actions only; the server validates every submission. */
export function ActionForm({ legalActions, view, submit }: {
  legalActions: readonly LegalAction[]; view: Pick<PlayerView, 'roleCards' | 'estateMarket' | 'players'>; submit: (action: Action) => void;
}) {
  const legal = legalActions[0];
  if (!legal) return <p>等待其他玩家行动…</p>;
  if (legal.phase === 'recruiter-placement') return <AllocationForm key={JSON.stringify(legal)} legal={legal} submit={submit} />;
  if (legal.phase === 'captain-retention') return <RetentionForm key={JSON.stringify(legal)} legal={legal} submit={submit} />;
  return (
    <div role="group" aria-label="可选行动">
      {describeOptions(legal, view)!.map(o => <button key={JSON.stringify(o.action)} onClick={() => submit(o.action)}>{o.label}</button>)}
    </div>
  );
}
