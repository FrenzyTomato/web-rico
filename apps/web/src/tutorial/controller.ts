import { createStore } from 'zustand/vanilla';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import type { Action } from '../actions/options.js';
import type { WorkerDraft } from '../actions/workerDraft.js';
import { targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import { applyCommand } from '@vibe-rico/game-engine';
import type { Good, GameState, GameCommand } from '@vibe-rico/game-engine';
import type { PlayerEvent } from '@vibe-rico/protocol';
import { initialTutorialGame, nextTutorialCommand, learner } from './scenario.js';
import { tutorialBroadcast } from './projection.js';

export interface TutorialStep { id: string; command: GameCommand; action: Action }
function nextStep(game: GameState): TutorialStep | null {
  const command = nextTutorialCommand(game);
  if (!command) return null;
  const { actorId: _, ...action } = command;
  return { id: `${game.revision}:${command.kind}`, command, action: action as Action };
}
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
    case 'plant': return a.choice.kind === 'estate' ? [{ kind: 'estate', id: a.choice.tileId }] : a.choice.kind === 'quarry' ? [{ kind: 'quarry' }] : [];
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

/** Whether `target` may be used now. Holds and depot slots stand for the ship or depot they belong to. */
export function allowsTarget(step: TutorialStep, draft: WorkerDraft | null, good: Good | null, target: SceneTarget): boolean {
  const whole: SceneTarget = target.kind === 'ship-slot' ? { kind: 'ship', id: target.id } : target.kind === 'depot-slot' ? { kind: 'depot' } : target;
  return allowedTargets(step, draft, good).some(t => targetKey(t) === targetKey(whole));
}

/** After a role is picked: the learner's first move in that role's phase, or null when the phase passes them by. */
export function learnerFollowUp(game: GameState): Action | null {
  let state = game;
  for (let i = 0; i < 40 && state.phase.kind !== 'role-selection'; i++) {
    const step = nextStep(state);
    if (!step) return null;
    if (step.command.actorId === learner) return step.action;
    const result = applyCommand(state, step.command);
    if (!result.ok) return null;
    state = result.state;
  }
  return null;
}

/** A move that has been applied, kept so the guide can explain it and its follow-up. */
export interface TutorialMove { step: TutorialStep; events: readonly PlayerEvent[] }
export interface TutorialState {
  /**
   * intro: opening pages before any move; action: learner's move; result: the learner checks what their move added to their island, or reads about the role they picked;
   * opponent: preview of a scripted move; opponent-result: that move has been applied.
   */
  generation: number; index: number; stage: 'intro' | 'action' | 'result' | 'opponent' | 'opponent-result' | 'finished' | 'disposed';
  game: GameState | null; step: TutorialStep | null; previous: TutorialMove | null; snapshot: PlayerBroadcast | null; history: readonly PlayerEvent[];
  submit(generation: number, stepId: string, revision: number, action: Action): boolean;
  opponentMove(generation: number, index: number): boolean;
  next(generation: number, index: number): void; begin(generation: number): void; reset(): void; dispose(): void;
}
/** The learner's moves followed by a pause: new estates and buildings on their island, and role picks to explain. */
const PAUSE_AFTER: readonly Action['kind'][] = ['plant', 'build', 'choose-role'];
const stageFor = (step: TutorialStep | null) => !step ? 'finished' as const : step.command.actorId === learner ? 'action' as const : 'opponent' as const;
const fresh = () => {
  const game = initialTutorialGame(), step = nextStep(game);
  return { index: 0, game, step, previous: null, snapshot: tutorialBroadcast(game), history: [] as readonly PlayerEvent[], stage: 'intro' as TutorialState['stage'] };
};
export function createTutorialController() {
  return createStore<TutorialState>()((set, get) => {
    const execute = () => {
      const s = get();
      if (!s.game || !s.step) return null;
      const result = applyCommand(s.game, s.step.command);
      if (!result.ok) return null;
      const snapshot = tutorialBroadcast(result.state, result.events);
      return { game: result.state, snapshot, history: [...s.history, ...snapshot.events], previous: { step: s.step, events: snapshot.events } };
    };
    return {
      generation: 0, ...fresh(),
      submit: (generation, stepId, revision, action) => {
        const s = get();
        if (s.generation !== generation || s.stage !== 'action' || !s.step || s.step.command.actorId !== learner || s.step.id !== stepId || revision !== s.snapshot?.revision || !sameAction(action, s.step.action)) return false;
        const applied = execute();
        if (!applied) return false;
        // Pause on the learner's island for new estates and buildings, and on the role explanation. Others are explained with the next move.
        // The learner's move can also end a Recruiter turn or the loading: pause on the refilled hiring pool or the ships.
        const ended = (s.step.action.kind === 'allocate-workers' && applied.game.phase.kind !== 'recruiter-placement')
          || (s.step.action.kind === 'load' && applied.game.phase.kind !== 'captain-loading');
        if (PAUSE_AFTER.includes(s.step.action.kind) || ended) { set({ ...applied, index: s.index + 1, stage: 'result' }); return true; }
        const step = nextStep(applied.game);
        set({ ...applied, index: s.index + 1, step: step ?? s.step, stage: stageFor(step) });
        return true;
      },
      opponentMove: (generation, index) => {
        const s = get();
        if (s.generation !== generation || s.index !== index || s.stage !== 'opponent') return false;
        const applied = execute();
        if (!applied) return false;
        set({ ...applied, index: s.index + 1, stage: 'opponent-result' });
        return true;
      },
      next: (generation, index) => {
        const s = get();
        if (s.generation !== generation || s.index !== index || !s.game || (s.stage !== 'opponent-result' && s.stage !== 'result')) return;
        const step = nextStep(s.game);
        set({ index: s.index + 1, step: step ?? s.step, stage: stageFor(step) });
      },
      begin: generation => {
        const s = get();
        if (s.generation === generation && s.stage === 'intro') set({ stage: stageFor(s.step) });
      },
      reset: () => set({ generation: get().generation + 1, ...fresh() }),
      dispose: () => set({ generation: get().generation + 1, index: 0, stage: 'disposed', game: null, step: null, previous: null, snapshot: null, history: [] }),
    };
  });
}
