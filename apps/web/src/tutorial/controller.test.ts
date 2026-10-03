import { describe, expect, it } from 'vitest';
import { allowedTargets, createTutorialController, lesson } from './controller.js';
import { initialWorkers } from '../actions/workerDraft.js';
import { act, renderHook } from '@testing-library/react';
import { useBoardActions } from '../actions/useBoardActions.js';
import { targetKey } from '../scene/Selection.js';

describe('tutorial isolation', () => {
  it('blocks even normally legal draft selections at the shared board-action boundary', () => {
    const step = lesson.find(s => s.id === 'workers')!;
    const { result, unmount } = renderHook(() => useBoardActions(step.before, true, [], () => {},
      (target, draft, good) => allowedTargets(step, draft, good).some(t => targetKey(t) === targetKey(target))));
    const before = structuredClone(result.current.draft);
    act(() => result.current.select({ kind: 'worker', id: 'pool', index: 0 }));
    expect(result.current.selected).toBeNull();
    expect(result.current.draft).toEqual(before);
    const expected = allowedTargets(step, result.current.draft, null)[0]!;
    act(() => result.current.select(expected));
    expect(result.current.draft?.holding).toBe(true);
    const holding = structuredClone(result.current.draft);
    const market = step.before.view.players.find(p => p.playerId === 'alice')!.buildings[0]!;
    act(() => result.current.select({ kind: 'owned-building', id: market.instanceId }));
    expect(result.current.draft).toEqual(holding);
    unmount();
  });
  it('rejects unintended, stale and duplicate commands without advancing', () => {
    const c = createTutorialController(), first = lesson[0]!;
    expect(c.getState().submit(0, first.id, 0, { kind: 'choose-role', roleCardId: first.before.view.roleCards[1]!.instanceId })).toBe(false);
    expect(c.getState().stage).toBe('action');
    expect(c.getState().submit(0, first.id, 1, first.action)).toBe(false);
    expect(c.getState().submit(0, 'another-step', 0, first.action)).toBe(false);
    expect(c.getState().submit(0, first.id, 0, first.action)).toBe(true);
    expect(c.getState().submit(0, first.id, 0, first.action)).toBe(false);
    c.getState().next(0, c.getState().index);
    expect(c.getState().submit(0, first.id, 0, first.action)).toBe(false);
    expect(c.getState().index).toBe(1);
  });
  it('finishes every expected action and erases progress immediately on dispose', () => {
    const c = createTutorialController();
    for (const step of lesson) {
      expect(c.getState().submit(0, step.id, step.before.revision, step.action)).toBe(true);
      c.getState().next(0, c.getState().index);
    }
    expect(c.getState().stage).toBe('finished');
    c.getState().dispose();
    expect(c.getState()).toMatchObject({ snapshot: null, index: 0, stage: 'disposed' });
    expect(c.getState().submit(0, lesson[0]!.id, 0, lesson[0]!.action)).toBe(false);
    c.getState().next(0, c.getState().index);
    expect(c.getState().snapshot).toBeNull();
    c.getState().reset();
    expect(c.getState().submit(0, lesson[0]!.id, 0, lesson[0]!.action)).toBe(false);
    expect(c.getState()).toMatchObject({ index: 0, stage: 'action', snapshot: lesson[0]!.before });
  });
  it('only exposes the next worker operation, including relocating the staffed worker', () => {
    const step = lesson.find(s => s.id === 'workers')!;
    const me = step.before.view.players.find(p => p.playerId === 'alice')!;
    const draft = initialWorkers(me), fruit = me.countryside.find(t => t.kind === 'fruit')!, corn = me.countryside.find(t => t.kind === 'corn')!;
    expect(allowedTargets(step, draft, null)).toEqual([{ kind: 'worker', id: fruit.instanceId, index: 0 }]);
    draft.counts[fruit.instanceId] = 0; draft.holding = true;
    expect(allowedTargets(step, draft, null)).toEqual([{ kind: 'tile', id: corn.instanceId }]);
    draft.counts[corn.instanceId] = 1; draft.holding = false;
    expect(allowedTargets(step, draft, null)).toEqual([{ kind: 'worker', id: 'pool', index: 0 }]);
    draft.holding = true;
    expect(allowedTargets(step, draft, null)).toEqual([{ kind: 'owned-building', id: me.buildings[0]!.instanceId }]);
    draft.counts[me.buildings[0]!.instanceId] = 1; draft.holding = false;
    expect(allowedTargets(step, draft, null)).toEqual([]);
  });
});
