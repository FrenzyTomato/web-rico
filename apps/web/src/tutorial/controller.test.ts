import { describe, expect, it } from 'vitest';
import { applyCommand } from '@vibe-rico/game-engine';
import { allowedTargets, allowsTarget, createTutorialController, sameAction } from './controller.js';
import { act, renderHook } from '@testing-library/react';
import { useBoardActions } from '../actions/useBoardActions.js';
import { targetKey } from '../scene/Selection.js';

function advance(c: ReturnType<typeof createTutorialController>) {
  const s = c.getState();
  if (s.stage === 'opponent') {
    expect(s.opponentMove(s.generation, s.index)).toBe(true);
    expect(c.getState().stage).toBe('opponent-result');
    c.getState().next(s.generation, s.index + 1);
  } else expect(s.submit(s.generation, s.step!.id, s.snapshot!.revision, s.step!.action)).toBe(true);
}

describe('continuous tutorial simulation', () => {
  it('executes every command through the engine without skipping opponent moves or follow-ups', () => {
    const c = createTutorialController();
    const commands = [];
    for (let i = 0; i < 100 && c.getState().stage !== 'finished'; i++) {
      const before = c.getState();
      commands.push(before.step!.command);
      const independentlyApplied = applyCommand(before.game!, before.step!.command);
      expect(independentlyApplied.ok).toBe(true);
      advance(c);
      if (independentlyApplied.ok) expect(c.getState().game).toEqual(independentlyApplied.state);
      expect(c.getState().snapshot!.revision).toBe(before.snapshot!.revision + 1);
    }
    expect(c.getState().stage).toBe('finished');
    expect(commands.filter(c => c.kind === 'choose-role')).toHaveLength(8);
    expect(commands.filter(c => c.actorId === 'alice' && c.kind === 'choose-role')).toHaveLength(3);
    expect(commands.at(-1)!.actorId).not.toBe('alice');
    expect(c.getState().game!.phase.kind).toBe('role-selection');
    expect(c.getState().history.length).toBeGreaterThan(20);
  });
  it('rejects wrong, duplicate, stale and opponent submissions', () => {
    const c = createTutorialController(), first = c.getState();
    expect(first.submit(0, first.step!.id, 0, { kind: 'choose-role', roleCardId: first.snapshot!.view.roleCards[1]!.instanceId })).toBe(false);
    expect(first.submit(0, first.step!.id, 1, first.step!.action)).toBe(false);
    expect(first.submit(0, 'another-step', 0, first.step!.action)).toBe(false);
    expect(first.submit(0, first.step!.id, 0, first.step!.action)).toBe(true);
    expect(first.submit(0, first.step!.id, 0, first.step!.action)).toBe(false);
    expect(c.getState()).toMatchObject({ stage: 'action', index: 1, previous: { step: first.step } });
    advance(c); // learner planting, then Bruno's follow-up
    const bot = c.getState();
    expect(bot.stage).toBe('opponent');
    expect(bot.submit(0, bot.step!.id, bot.snapshot!.revision, bot.step!.action)).toBe(false);
    expect(bot.opponentMove(0, bot.index)).toBe(true);
    expect(bot.opponentMove(0, bot.index)).toBe(false);
    c.getState().next(0, bot.index);
    expect(c.getState().stage).toBe('opponent-result');
    c.getState().next(0, bot.index + 1);
    expect(c.getState().stage).toBe('opponent');
  });
  it('disposes the entire simulated game and invalidates queued opponent callbacks even after restart', () => {
    const c = createTutorialController(); advance(c); advance(c);
    const pending = c.getState();
    c.getState().dispose();
    expect(c.getState()).toMatchObject({ game: null, step: null, snapshot: null, history: [], stage: 'disposed', index: 0 });
    expect(pending.opponentMove(pending.generation, pending.index)).toBe(false);
    c.getState().reset();
    expect(pending.opponentMove(pending.generation, pending.index)).toBe(false);
    pending.next(pending.generation, pending.index);
    expect(c.getState().snapshot!.revision).toBe(0);
  });
  it('restricts each worker substep while keeping the real placement draft', () => {
    const c = createTutorialController();
    for (let i = 0; i < 60 && !(c.getState().stage === 'action' && c.getState().step?.action.kind === 'allocate-workers' && c.getState().game?.roundNumber === 2); i++) advance(c);
    const s = c.getState(), step = s.step!;
    const { result, unmount } = renderHook(() => useBoardActions(s.snapshot, true, [], () => {},
      (target, draft, good) => allowedTargets(step, draft, good).some(t => targetKey(t) === targetKey(target))));
    const me = s.snapshot!.view.players[0]!;
    const corn = me.countryside.find(t => t.kind === 'corn')!, fruit = me.countryside.find(t => t.kind === 'fruit')!, market = me.buildings[0]!;
    const before = structuredClone(result.current.draft);
    act(() => result.current.select({ kind: 'worker', id: corn.instanceId, index: 0 }));
    expect(result.current.selected).toBeNull(); expect(result.current.draft).toEqual(before);
    expect(allowedTargets(step, result.current.draft, null)).toEqual([{ kind: 'worker', id: 'pool', index: 0 }]);
    act(() => result.current.select(allowedTargets(step, result.current.draft, null)[0]!));
    const holding = structuredClone(result.current.draft);
    act(() => result.current.select({ kind: 'tile', id: fruit.instanceId }));
    expect(result.current.draft).toEqual(holding);
    act(() => result.current.select({ kind: 'owned-building', id: market.instanceId }));
    expect(result.current.canConfirm).toBe(true);
    expect(sameAction(step.action, step.action)).toBe(true);
    unmount();
  });
  it('lets a ship hold or depot slot stand for its ship or depot, as in normal play', () => {
    const c = createTutorialController();
    for (let i = 0; i < 80 && !(c.getState().stage === 'action' && c.getState().step?.action.kind === 'load'); i++) advance(c);
    const step = c.getState().step!;
    if (step.action.kind !== 'load' || step.action.shipment.kind !== 'cargo') throw Error('expected a cargo load');
    const { shipId, good } = step.action.shipment;
    expect(allowsTarget(step, null, good, { kind: 'ship-slot', id: shipId, index: 2 })).toBe(true);
    expect(allowsTarget(step, null, good, { kind: 'ship-slot', id: 'another-ship', index: 0 })).toBe(false);
    expect(allowsTarget(step, null, null, { kind: 'ship-slot', id: shipId, index: 0 })).toBe(false);
  });
});
