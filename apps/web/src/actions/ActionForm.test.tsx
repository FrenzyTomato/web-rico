import { beforeEach as setTestLocale } from 'vitest';
import { setLanguage as setTestLanguage } from '../i18n/language.js';
setTestLocale(() => setTestLanguage('zh'));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameState, Good } from '@vibe-rico/game-engine';
import type { PlayerBroadcast, RoomState } from '@vibe-rico/protocol';
import * as three from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import * as four from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-4p.js';
import * as five from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-5p.js';
import { rejectionText } from '../debug/GameView.js';
import { GameShell } from '../layout/GameShell.js';
import { ScoreView } from '../debug/ScoreView.js';
import { createGameStore } from '../state/gameStore.js';
import { ActionForm, describeOptions } from './ActionForm.js';
import { GOOD } from '../i18n/terms.js';

afterEach(cleanup);
const withoutActor = (c: unknown) => { const { actorId: _, ...rest } = c as { actorId: string }; return rest; };

/** Every decision of a frozen PR-036 game: the state, the actor's descriptor, and the command actually played. */
function* decisions(fixture: { input: unknown; commands: readonly unknown[] }) {
  const created = createGame(fixture.input as CreateGameInput);
  if (!created.ok) throw Error(created.error.message);
  let state: GameState = created.state;
  for (const command of fixture.commands) {
    const actor = (command as GameCommand).actorId;
    yield { state, legal: getLegalCommands(state, actor)[0]!, command: command as GameCommand };
    const result = applyCommand(state, command as GameCommand);
    if (!result.ok) throw Error(result.error.message);
    state = result.state;
  }
}
const GOODS: Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];

describe('every action descriptor constructs a request', () => {
  it.each([['3p', three], ['4p', four], ['5p', five]] as const)('%s: discrete options are all engine-accepted and include the move played', (_, fixture) => {
    let checked = 0;
    for (const { state, legal, command } of decisions(fixture)) {
      const options = describeOptions(legal, state);
      if (!options) continue;
      for (const o of options) {
        expect(applyCommand(state, { ...o.action, actorId: legal.actorId } as GameCommand)).toMatchObject({ ok: true });
      }
      expect(options.map(o => o.action)).toContainEqual(withoutActor(command));
      // Each option must be distinguishable by its label.
      expect(new Set(options.map(o => o.label)).size).toBe(options.length);
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it.each([['3p', three], ['4p', four], ['5p', five]] as const)('%s: worker allocation and retention forms submit the move played', (_, fixture) => {
    const phases = new Set<string>();
    for (const { state, legal, command } of decisions(fixture)) {
      if (legal.phase !== 'recruiter-placement' && legal.phase !== 'captain-retention') continue;
      const submit = vi.fn();
      render(<ActionForm legalActions={[legal]} view={state} submit={submit} />);
      if (legal.phase === 'recruiter-placement' && command.kind === 'allocate-workers') {
        const inputs = screen.getAllByRole('spinbutton');
        legal.slots.forEach((slot, i) => {
          const value = slot.kind === 'countryside'
            ? Number(command.allocation.countryside.find(t => t.tileId === slot.instanceId)!.occupied)
            : command.allocation.buildings.find(b => b.buildingId === slot.instanceId)!.occupiedSlots;
          fireEvent.change(inputs[i]!, { target: { value: String(value) } });
        });
        fireEvent.click(screen.getByText('确认分配'));
      }
      if (legal.phase === 'captain-retention' && command.kind === 'retain') {
        for (const g of GOODS.filter(g => legal.available[g] > 0)) {
          fireEvent.change(screen.getByLabelText(new RegExp(`^${GOOD[g]} 保留`)), { target: { value: String(command.retained[g]) } });
          if (command.warehouseTypes.includes(g)) fireEvent.click(screen.getByLabelText(`仓库保护 ${GOOD[g]}`));
        }
        fireEvent.click(screen.getByText('确认保留'));
      }
      expect(submit).toHaveBeenCalledWith(withoutActor(command));
      expect(applyCommand(state, command)).toMatchObject({ ok: true });
      phases.add(legal.phase);
      cleanup();
    }
    expect([...phases].sort()).toEqual(['captain-retention', 'recruiter-placement']);
  });
});

describe('game screen', () => {
  const room: RoomState = { roomCode: 'C', hostPlayerId: 'alice', started: true,
    seats: [{ playerId: 'alice', displayName: 'Alice' }, { playerId: 'bruno', displayName: 'Bruno' }, { playerId: 'chen', displayName: 'Chen' }] };

  it.each(['builder-choice', 'planter-choice'] as const)('%s guides board selection, keeps skip available and collapses keyboard choices', phase => {
    const { state, legal } = [...decisions(three)].find(t => t.legal.phase === phase)!;
    const submit = vi.fn();
    const { container } = render(<ActionForm boardFirst legalActions={[legal]} view={state} submit={submit} />);
    expect(screen.getByRole('status').textContent).toContain('描边');
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(details.querySelectorAll('button').length).toBeGreaterThan(0);
    const skip = screen.getByRole('button', { name: phase === 'builder-choice' ? '不建造' : '放弃' });
    fireEvent.click(skip);
    expect(submit).toHaveBeenCalledWith(phase === 'builder-choice' ? { kind: 'build', purchase: null } : { kind: 'plant', choice: { kind: 'decline' } });
  });

  it('selects the second worker without highlighting the first or opening an empty action panel', () => {
    const { state, legal } = [...decisions(three)].find(({ state, legal }) => legal.phase === 'recruiter-placement'
      && state.players.find(p => p.playerId === legal.actorId)!.idleWorkerCount >= 2)!;
    const store = createGameStore({ send: () => new Promise(() => {}) });
    store.getState().sessionReady();
    store.getState().receive({ protocolVersion: '1', revision: state.revision, events: [], legalActions: [legal],
      view: { ...state, players: state.players.map(({ earnedVp: _, ...p }) => p), viewer: { playerId: legal.actorId, earnedVp: 0 } } });
    render(<GameShell store={store} roomId="r" room={room} />);
    fireEvent.click(screen.getByRole('button', { name: '选择工人 2' }));
    expect(screen.getByRole('button', { name: '选择工人 2' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '选择工人 1' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByText('此对象当前没有可执行的行动')).toBeNull();
  });

  it('shows a server rejection clearly and keeps the latest view', () => {
    const store = createGameStore({ send: () => new Promise(() => {}) });
    const created = createGame(three.input as unknown as CreateGameInput);
    if (!created.ok) throw Error('setup');
    const s = created.state;
    const view = { viewer: { playerId: 'alice', earnedVp: 0 }, seatOrder: s.seatOrder, players: s.players.map(({ earnedVp: _, ...p }) => p),
      governorPlayerId: s.governorPlayerId, roundNumber: s.roundNumber, roleSelectionIndex: s.roleSelectionIndex, roleCards: s.roleCards,
      phase: s.phase, supply: s.supply, estateMarket: s.estateMarket, estateDiscard: s.estateDiscard, endTriggers: s.endTriggers, ships: s.ships, tradingHouse: s.tradingHouse };
    act(() => {
      store.getState().sessionReady();
      store.getState().receive({ protocolVersion: '1', revision: 0, view, legalActions: getLegalCommands(s, 'alice' as never), events: [] } as unknown as PlayerBroadcast);
      store.setState({ rejection: { commandId: 'c', code: 'ILLEGAL_COMMAND', ruleId: 'ROLE-001' } });
    });
    render(<GameShell store={store} roomId="r" room={room} lobbyHref="/?lobby=1" />);
    expect(screen.getAllByRole('link', { name: '返回大厅' })[0]!.getAttribute('href')).toBe('/?lobby=1');
    expect(screen.getByRole('alert').textContent).toBe('操作不符合当前规则，请重新选择');
    expect(rejectionText({ commandId: 'c', code: 'STALE_REVISION', currentRevision: 2 })).toBe('状态已更新，请根据最新局面重新选择');
    expect(within(screen.getByRole('group', { name: '可选行动' })).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByLabelText('回合信息').textContent).toContain('Alice 的回合');
    expect(screen.getByLabelText('玩家列表').hidden).toBe(true);
    expect(screen.getByLabelText('回合信息').hidden).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /^玩家$/ }));
    expect(screen.getByLabelText('玩家列表').hidden).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /^时间线$/ }));
    expect(screen.getByLabelText('回合信息').hidden).toBe(false);
  });

  it('renders the itemized final scores in rank order with names', () => {
    const created = createGame(three.input as unknown as CreateGameInput);
    if (!created.ok) throw Error('setup');
    let state = created.state;
    for (const c of three.commands) { const r = applyCommand(state, c as GameCommand); if (!r.ok) throw Error(r.error.message); state = r.state; }
    if (state.phase.kind !== 'game-over') throw Error('no game over');
    render(<ScoreView scores={state.phase.scores} names={Object.fromEntries(room.seats.map(s => [s.playerId, s.displayName]))} />);
    const rows = screen.getAllByRole('row').slice(1).map(r => [...r.querySelectorAll('td')].map(td => td.textContent));
    // PR-036 3p fixture: totals 41/34/46 → ranks 2/3/1; columns are rank, name, earned, base, five bonuses, total, tiebreak.
    expect(rows.map(r => [r[0], r[1], r[9]])).toEqual([['1', 'Chen', '46'], ['2', 'Alice', '41'], ['3', 'Bruno', '34']]);
    expect(rows.every(r => r.length === 11)).toBe(true);
  });
});
