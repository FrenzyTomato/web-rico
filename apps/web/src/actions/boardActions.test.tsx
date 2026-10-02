import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { applyCommand, createGame, getLegalCommands, BUILDINGS } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameState } from '@vibe-rico/game-engine';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import * as fixture from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { allocationAction, draftPlayer, idleWorkers, initialWorkers, moveWorker } from './workerDraft.js';
import { describeOptions } from './options.js';
import { useBoardActions } from './useBoardActions.js';
import { ESTATE_WORKER_SLOTS, buildingWorkerSlots } from '../scene/workerSlots.js';
import { ResourceDock } from '../layout/ResourceDock.js';
import { SceneInteractionProvider, targetKey } from '../scene/Selection.js';

afterEach(cleanup);
function* turns() {
  const created = createGame(fixture.input as unknown as CreateGameInput);
  if (!created.ok) throw Error('setup');
  let state = created.state;
  for (const raw of fixture.commands) {
    const command = raw as GameCommand;
    const legal = getLegalCommands(state, command.actorId)[0]!;
    yield { state, legal, command };
    const result = applyCommand(state, command);
    if (!result.ok) throw Error(result.error.message);
    state = result.state;
  }
}
function broadcast(state: GameState, actor: GameCommand['actorId']): PlayerBroadcast {
  return { protocolVersion: '1', revision: state.revision, events: [], legalActions: getLegalCommands(state, actor),
    view: { ...state, players: state.players.map(({ earnedVp: _, ...player }) => player), viewer: { playerId: actor, earnedVp: state.players.find(p => p.playerId === actor)!.earnedVp } } };
}

describe('worker sockets and click placement', () => {
  it('lets all seats draft together and preserves drafts when another seat confirms', () => {
    const turn = [...turns()].find(t => t.legal.phase === 'recruiter-placement')!;
    const clients = turn.state.seatOrder.map(actor => ({ actor, ...renderHook(
      ({ latest, enabled }) => useBoardActions(latest, enabled, [], vi.fn()),
      { initialProps: { latest: broadcast(turn.state, actor), enabled: true } },
    ) }));
    for (const client of clients) {
      expect(client.result.current.placement).not.toBeNull();
      act(() => client.result.current.select({ kind: 'worker', id: 'pool', index: 0 }));
      expect(client.result.current.draft!.holding).toBe(true);
    }
    const next = applyCommand(turn.state, turn.command);
    if (!next.ok) throw Error(next.error.message);
    for (const client of clients) {
      client.rerender({ latest: broadcast(next.state, client.actor), enabled: true });
      if (client.actor === turn.command.actorId) expect(client.result.current.placement).toBeNull();
      else {
        expect(client.result.current.draft!.holding).toBe(true);
        expect(client.result.current.selected).toEqual({ kind: 'worker', id: 'pool', index: 0 });
        client.rerender({ latest: broadcast(next.state, client.actor), enabled: false });
        client.rerender({ latest: broadcast(next.state, client.actor), enabled: true });
        expect(client.result.current.draft!.holding).toBe(false);
      }
    }
  });
  it('highlights the clicked pool worker, switches selection, and clears it after placement', () => {
    const turn = [...turns()].find(t => t.legal.phase === 'recruiter-placement'
      && t.state.players.find(p => p.playerId === t.command.actorId)!.idleWorkerCount >= 2
      && t.legal.slots.some(s => s.kind === 'countryside' && !t.state.players.find(p => p.playerId === t.command.actorId)!.countryside.find(c => c.instanceId === s.instanceId)!.occupied))!;
    const snapshot = broadcast(turn.state, turn.command.actorId);
    let board: ReturnType<typeof useBoardActions>;
    function Dock() {
      board = useBoardActions(snapshot, true, [], vi.fn());
      return <SceneInteractionProvider value={{ actionable: board.actionable, select: board.select, pulse: null, selectedKey: board.selected ? targetKey(board.selected) : null }}>
        <ResourceDock player={board.player!} points={0} />
      </SceneInteractionProvider>;
    }
    render(<Dock />);
    const left = screen.getByRole('button', { name: '选择工人 1' });
    const right = screen.getByRole('button', { name: '选择工人 2' });
    fireEvent.click(right);
    expect(right.getAttribute('aria-pressed')).toBe('true');
    expect(left.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(left);
    expect(left.getAttribute('aria-pressed')).toBe('true');
    expect(right.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(left);
    expect(board!.draft!.holding).toBe(false);
    expect(left.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(right);
    const slot = board!.placement!.slots.find(s => s.kind === 'countryside' && board!.draft!.counts[s.instanceId] === 0)!;
    const idle = board!.player!.idleWorkerCount;
    act(() => board.select({ kind: 'tile', id: slot.instanceId }));
    expect(board!.player!.idleWorkerCount).toBe(idle - 1);
    expect(board!.selected).toBeNull();
    expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0);
    // A worker taken off a tile is added to the end of the pool and highlighted there.
    act(() => board.select({ kind: 'worker', id: slot.instanceId, index: 0 }));
    expect(board!.selected).toEqual({ kind: 'worker', id: 'pool', index: idle - 1 });
    act(() => board.clear());
    expect(board!.draft!.holding).toBe(false);
    expect(board!.selected).toBeNull();
  });
  it('uses every canonical estate/building capacity', () => {
    const reference = JSON.parse(readFileSync('../../docs/reference/worker-slots.json', 'utf8'));
    expect(reference.estates).toEqual(ESTATE_WORKER_SLOTS);
    expect(reference.buildings).toEqual(Object.fromEntries(Object.entries(BUILDINGS).map(([id, b]) => [id, b.workerSlots])));
    expect(Object.values(ESTATE_WORKER_SLOTS)).toEqual([1, 1, 1, 1, 1, 1]);
    for (const [type, definition] of Object.entries(BUILDINGS)) expect(buildingWorkerSlots(type as keyof typeof BUILDINGS)).toBe(definition.workerSlots);
    expect(buildingWorkerSlots('large-coffee-roaster')).toBe(2);
    expect(buildingWorkerSlots('large-sugar-mill')).toBe(3);
  });
  it('every recruitment in the saved game can be completed through worker clicks and accepted by the engine', () => {
    let checked = 0;
    for (const { state, legal, command } of turns()) {
      if (legal.phase !== 'recruiter-placement') continue;
      const player = state.players.find(p => p.playerId === command.actorId)!;
      let draft = initialWorkers(player);
      expect(idleWorkers(legal, draft)).toBe(player.idleWorkerCount);
      // Also exercises moving already assigned workers into the pool.
      for (const slot of legal.slots) while (draft.counts[slot.instanceId]! > 0) {
        draft = moveWorker(legal, draft, { kind: 'pick', id: slot.instanceId });
        draft = moveWorker(legal, draft, { kind: 'pool' });
      }
      expect(idleWorkers(legal, draft)).toBe(legal.totalWorkers);
      for (const slot of legal.slots) while (draft.counts[slot.instanceId]! < slot.capacity && idleWorkers(legal, draft) > 0) {
        draft = moveWorker(legal, draft, { kind: 'pool' });
        draft = moveWorker(legal, draft, { kind: 'place', id: slot.instanceId });
      }
      const action = allocationAction(legal, draft)!;
      expect(action).not.toBeNull();
      const result = applyCommand(state, { ...action, actorId: command.actorId } as GameCommand);
      expect(result.ok).toBe(true);
      expect(draftPlayer(player, legal, draft).idleWorkerCount).toBe(idleWorkers(legal, draft));
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
  });
  it('rejects foreign/full destinations and incomplete allocation; resets after revision/disconnect', () => {
    const turn = [...turns()].find(t => t.legal.phase === 'recruiter-placement' && t.legal.slots.length > 0)!;
    const snapshot = broadcast(turn.state, turn.command.actorId);
    const submit = vi.fn();
    const { result, rerender } = renderHook(({ latest, enabled }) => useBoardActions(latest, enabled, [], submit), { initialProps: { latest: snapshot, enabled: true } });
    expect(result.current.canConfirm).toBe(false);
    act(() => result.current.select({ kind: 'worker', id: 'pool', index: 0 }));
    expect(result.current.draft!.holding).toBe(true);
    expect(result.current.actionable({ kind: 'tile', id: 'foreign' })).toBe(false);
    const slot = result.current.placement!.slots[0]!;
    act(() => result.current.select({ kind: slot.kind === 'countryside' ? 'tile' : 'owned-building', id: slot.instanceId }));
    expect(result.current.player!.countryside[0]!.occupied).toBe(true);
    expect(submit).not.toHaveBeenCalled();
    rerender({ latest: { ...snapshot, revision: snapshot.revision + 1 }, enabled: true });
    expect(result.current.draft!.counts[slot.instanceId]).toBe(1);
    rerender({ latest: snapshot, enabled: false });
    expect(result.current.placement).toBeNull();
    expect(result.current.actionable({ kind: 'worker', id: 'pool', index: 0 })).toBe(false);
  });
});

describe('crate destination interaction', () => {
  it.each([['trader-choice', false], ['captain-loading', false], ['trader-choice', true], ['captain-loading', true]] as const)('%s socket=%s uses only server-described choices for the selected good and destination', (phase, socket) => {
    const turn = [...turns()].find(t => t.legal.phase === phase && (phase === 'trader-choice'
      ? t.command.kind === 'trade' && t.command.sale !== null : t.command.kind === 'load'))!;
    const options = describeOptions(turn.legal, turn.state)!;
    const submit = vi.fn();
    const snapshot = broadcast(turn.state, turn.command.actorId);
    const command = turn.command;
    const good = command.kind === 'trade' ? command.sale!.good : command.kind === 'load' ? command.shipment.good : 'corn';
    const target = command.kind === 'load' ? command.shipment.kind === 'cargo'
      ? socket ? { kind: 'ship-slot' as const, id: command.shipment.shipId, index: 0 } : { kind: 'ship' as const, id: command.shipment.shipId } : { kind: 'personal-ship' as const } : socket ? { kind: 'depot-slot' as const, index: 0 } : { kind: 'depot' as const };
    const { result, rerender } = renderHook(({ latest }) => useBoardActions(latest, true, options, submit), { initialProps: { latest: snapshot } });
    if (socket) expect(result.current.actionable(target)).toBe(false);
    act(() => result.current.select({ kind: 'crate', good, index: 0 }));
    expect(result.current.actionable(target)).toBe(true);
    expect(result.current.actionable({ kind: 'ship-slot', id: 'foreign-ship', index: 0 })).toBe(false);
    expect(submit).not.toHaveBeenCalled();
    act(() => result.current.select(target));
    const choices = submit.mock.calls.length ? [{ action: submit.mock.calls[0]![0] }] : result.current.panelOptions;
    expect(choices.length).toBeGreaterThan(0);
    for (const { action } of choices) {
      expect(action.kind === 'trade' ? action.sale.good : action.shipment.good).toBe(good);
      expect(applyCommand(turn.state, { ...action, actorId: command.actorId }).ok).toBe(true);
    }
    rerender({ latest: { ...snapshot, revision: snapshot.revision + 1 } });
    expect(result.current.good).toBeNull();
  });
});
