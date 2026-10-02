import type { LegalAction } from '@vibe-rico/game-engine';
import type { PublicPlayerView } from '@vibe-rico/protocol';
import type { Action } from './options.js';

export type Placement = Extract<LegalAction, { phase: 'recruiter-placement' }>;
export type WorkerDraft = { counts: Record<string, number>; holding: boolean };
export function initialWorkers(player: PublicPlayerView): WorkerDraft {
  return { holding: false, counts: Object.fromEntries([
    ...player.countryside.map(t => [t.instanceId, Number(t.occupied)]),
    ...player.buildings.map(b => [b.instanceId, b.occupiedSlots]),
  ]) };
}
export const idleWorkers = (legal: Placement, draft: WorkerDraft) => legal.totalWorkers - Object.values(draft.counts).reduce((a, b) => a + b, 0);
export function moveWorker(legal: Placement, draft: WorkerDraft, target: { kind: 'pool' } | { kind: 'pick' | 'place'; id: string }): WorkerDraft {
  if (target.kind === 'pool') return { ...draft, holding: !draft.holding && idleWorkers(legal, draft) > 0 };
  const slot = legal.slots.find(s => s.instanceId === target.id);
  if (!slot) return draft;
  const count = draft.counts[target.id] ?? 0;
  if (target.kind === 'pick' && !draft.holding && count > 0) return { holding: true, counts: { ...draft.counts, [target.id]: count - 1 } };
  if (target.kind === 'place' && draft.holding && count < slot.capacity && idleWorkers(legal, draft) > 0)
    return { holding: false, counts: { ...draft.counts, [target.id]: count + 1 } };
  return draft;
}
export function allocationAction(legal: Placement, draft: WorkerDraft): Action | null {
  const idle = idleWorkers(legal, draft);
  const valid = legal.slots.every(s => Number.isInteger(draft.counts[s.instanceId]) && draft.counts[s.instanceId]! >= 0 && draft.counts[s.instanceId]! <= s.capacity);
  if (!valid || draft.holding || idle < 0 || (idle > 0 && legal.slots.some(s => draft.counts[s.instanceId] !== s.capacity))) return null;
  return { kind: 'allocate-workers', allocation: {
    countryside: legal.slots.flatMap(s => s.kind === 'countryside' ? [{ tileId: s.instanceId, occupied: draft.counts[s.instanceId] === 1 }] : []),
    buildings: legal.slots.flatMap(s => s.kind === 'building' ? [{ buildingId: s.instanceId, occupiedSlots: draft.counts[s.instanceId]! }] : []),
    idleCount: idle,
  } };
}
export function draftPlayer(player: PublicPlayerView, legal: Placement, draft: WorkerDraft): PublicPlayerView {
  return { ...player, idleWorkerCount: idleWorkers(legal, draft),
    countryside: player.countryside.map(t => ({ ...t, occupied: draft.counts[t.instanceId] === 1 })),
    buildings: player.buildings.map(b => ({ ...b, occupiedSlots: draft.counts[b.instanceId] ?? 0 })),
  };
}
