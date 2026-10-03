import { createStore } from 'zustand/vanilla';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import type { Action } from '../actions/options.js';
import type { WorkerDraft } from '../actions/workerDraft.js';
import type { SceneTarget } from '../scene/Selection.js';
import type { Good } from '@vibe-rico/game-engine';
import raw from './fixture.json?raw';

export interface TutorialStep { id: string; before: PlayerBroadcast; action: Action; after: PlayerBroadcast }
export const lesson = JSON.parse(raw) as readonly TutorialStep[];
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
};
export const sameAction = (a: Action, b: Action) => canonical(a) === canonical(b);

/** The only targets which may mutate a selection or draft in this substep. */
export function allowedTargets(step: TutorialStep, draft: WorkerDraft | null, good: Good | null): SceneTarget[] {
  const a = step.action;
  switch (a.kind) {
    case 'choose-role': return [{ kind: 'role', id: a.roleCardId }];
    case 'plant': return a.choice.kind === 'estate' ? [{ kind: 'estate', id: a.choice.tileId }] : [];
    case 'build': return a.purchase ? [{ kind: 'building', type: a.purchase.buildingTypeId }] : [];
    case 'take-production-bonus': return a.good ? [{ kind: 'good', good: a.good }] : [];
    case 'trade': return !a.sale ? [] : good === a.sale.good ? [{ kind: 'depot' }] : [{ kind: 'crate', good: a.sale.good, index: 0 }];
    case 'load': return good === a.shipment.good && a.shipment.kind === 'cargo' ? [{ kind: 'ship', id: a.shipment.shipId }] : [{ kind: 'crate', good: a.shipment.good, index: 0 }];
    case 'allocate-workers': {
      if (!draft) return [];
      const desired = [...a.allocation.countryside.map(t => ({ id: t.tileId, count: Number(t.occupied), kind: 'tile' as const })),
        ...a.allocation.buildings.map(b => ({ id: b.buildingId, count: b.occupiedSlots, kind: 'owned-building' as const }))];
      const extra = desired.find(t => (draft.counts[t.id] ?? 0) > t.count);
      const missing = desired.find(t => (draft.counts[t.id] ?? 0) < t.count);
      if (draft.holding) return missing ? [{ kind: missing.kind, id: missing.id }] : [];
      if (extra) return [{ kind: 'worker', id: extra.id, index: 0 }];
      return missing ? [{ kind: 'worker', id: 'pool', index: 0 }] : [];
    }
    default: return [];
  }
}

interface TutorialState {
  generation: number; index: number; stage: 'action' | 'result' | 'finished' | 'disposed'; snapshot: PlayerBroadcast | null;
  submit(generation: number, stepId: string, revision: number, action: Action): boolean;
  next(generation: number, index: number): void; reset(): void; dispose(): void;
}
export function createTutorialController() {
  return createStore<TutorialState>()((set, get) => ({
    generation: 0, index: 0, stage: 'action', snapshot: structuredClone(lesson[0]!.before),
    submit: (generation, stepId, revision, action) => {
      const s = get(), step = lesson[s.index];
      if (s.generation !== generation || s.stage !== 'action' || !step || step.id !== stepId || revision !== s.snapshot?.revision || !sameAction(action, step.action)) return false;
      set({ stage: 'result', snapshot: structuredClone(step.after) }); return true;
    },
    next: (generation, index) => {
      const s = get();
      if (s.generation !== generation || s.index !== index || s.stage !== 'result') return;
      if (s.index + 1 === lesson.length) { set({ stage: 'finished' }); return; }
      set({ index: s.index + 1, stage: 'action', snapshot: structuredClone(lesson[s.index + 1]!.before) });
    },
    reset: () => set({ generation: get().generation + 1, index: 0, stage: 'action', snapshot: structuredClone(lesson[0]!.before) }),
    dispose: () => set({ generation: get().generation + 1, index: 0, stage: 'disposed', snapshot: null }),
  }));
}
