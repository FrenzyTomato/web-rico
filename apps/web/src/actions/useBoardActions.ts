import { useState } from 'react';
import type { Good } from '@vibe-rico/game-engine';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { optionsForTarget, targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import type { Action, Option } from './options.js';
import { allocationAction, draftPlayer, idleWorkers, initialWorkers, moveWorker } from './workerDraft.js';
import type { WorkerDraft } from './workerDraft.js';

/** Local, revision-scoped previews. Only explicit completed actions go to the authoritative server. */
export function useBoardActions(latest: PlayerBroadcast | null, enabled: boolean, options: readonly Option[], submit: (a: Action) => void) {
  const legal = latest?.legalActions[0];
  const me = latest?.view.players.find(p => p.playerId === latest.view.viewer.playerId);
  // Other players confirming recruitment must not erase this player's local draft.
  const epoch = legal?.phase === 'recruiter-placement'
    ? JSON.stringify([latest?.view.roundNumber, latest?.view.roleSelectionIndex, legal, me, enabled])
    : `${latest?.revision}:${enabled}`;
  const [local, setLocal] = useState<{ epoch: string; draft?: WorkerDraft; selected: SceneTarget | null; good: Good | null }>({ epoch, selected: null, good: null });
  // Reset synchronously when the turn/revision/connection changes, including reconnects at the same revision.
  if (local.epoch !== epoch) setLocal({ epoch, selected: null, good: null });
  const current = local.epoch === epoch ? local : { epoch, selected: null, good: null };
  const placement = enabled && legal?.phase === 'recruiter-placement' ? legal : null;
  const draft = placement && me ? current.draft ?? initialWorkers(me) : null;
  const selected = current.selected;
  const destinationOptions = (target: SceneTarget) => optionsForTarget(options, target).filter(o => {
    if (!current.good || !['ship', 'ship-slot', 'personal-ship', 'depot', 'depot-slot'].includes(target.kind)) return true;
    return o.action.kind === 'load' ? o.action.shipment.good === current.good : o.action.kind === 'trade' && o.action.sale?.good === current.good;
  });
  function actionable(target: SceneTarget): boolean {
    if (!enabled) return false;
    if ((target.kind === 'ship-slot' || target.kind === 'depot-slot') && !current.good) return false;
    if (placement && draft) {
      if (target.kind === 'worker') return target.id === 'pool' ? target.index >= 0 && target.index < idleWorkers(placement, draft)
        : !draft.holding && (draft.counts[target.id] ?? 0) > target.index;
      if (target.kind === 'tile' || target.kind === 'owned-building') {
        const slot = placement.slots.find(s => s.instanceId === target.id);
        return !!slot && draft.holding && (draft.counts[target.id] ?? 0) < slot.capacity;
      }
    }
    return destinationOptions(target).length > 0;
  }
  function select(target: SceneTarget) {
    if (!actionable(target)) return;
    if (placement && draft && ['worker', 'tile', 'owned-building'].includes(target.kind)) {
      // Pool workers share game rules, but each portrait needs its own selection identity.
      if (target.kind === 'worker' && target.id === 'pool' && draft.holding && selected && targetKey(selected) !== targetKey(target)) {
        setLocal({ ...current, selected: target }); return;
      }
      const next = moveWorker(placement, draft, target.kind === 'worker'
        ? target.id === 'pool' ? { kind: 'pool' } : { kind: 'pick', id: target.id }
        : { kind: 'place', id: (target as { id: string }).id });
      const picked = next.holding && target.kind === 'worker'
        ? target.id === 'pool' ? target : { kind: 'worker' as const, id: 'pool', index: idleWorkers(placement, next) - 1 }
        : null;
      setLocal({ ...current, draft: next, selected: picked }); return;
    }
    if (target.kind === 'crate') { setLocal({ ...current, good: target.good, selected: target }); return; }
    const choices = destinationOptions(target);
    if (current.good && ['ship', 'ship-slot', 'personal-ship', 'depot', 'depot-slot'].includes(target.kind) && choices.length === 1) {
      submit(choices[0]!.action); setLocal({ ...current, selected: null, good: null }); return;
    }
    setLocal({ ...current, selected: target });
  }
  const clear = () => setLocal({ ...current, selected: null, good: null, ...(draft ? { draft: { ...draft, holding: false } } : {}) });
  const action = placement && draft ? allocationAction(placement, draft) : null;
  return {
    actionable, select, selected, clear, good: current.good, placement, draft,
    panelOptions: enabled && selected && selected.kind !== 'crate' ? destinationOptions(selected) : [],
    player: placement && draft && me ? draftPlayer(me, placement, draft) : undefined,
    reset: () => setLocal({ epoch, selected: null, good: null }),
    canConfirm: !!action,
    confirm: () => { if (action && enabled) submit(action); },
  };
}
