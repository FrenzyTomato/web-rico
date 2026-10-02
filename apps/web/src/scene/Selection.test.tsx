import { beforeEach as setTestLocale } from 'vitest';
import { setLanguage as setTestLanguage } from '../i18n/language.js';
setTestLocale(() => setTestLanguage('zh'));
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { isDeepStrictEqual } from 'node:util';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameState, Good } from '@vibe-rico/game-engine';
import * as three from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import * as four from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-4p.js';
import * as five from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-5p.js';
import { ActionPanel } from '../actions/ActionPanel.js';
import { describeOptions } from '../actions/options.js';
import { BUILDING_ORDER } from './pieces.js';
import { optionsForTarget } from './Selection.js';
import type { SceneTarget } from './Selection.js';

afterEach(cleanup);
const GOODS: Good[] = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'];
/** Every object the viewer could point at in this state. */
function targets(state: GameState, actor: string): SceneTarget[] {
  const me = state.players.find(p => p.playerId === actor)!;
  return [
    ...state.roleCards.map(c => ({ kind: 'role', id: c.instanceId }) as const),
    ...state.estateMarket.map(t => ({ kind: 'estate', id: t.instanceId }) as const),
    { kind: 'quarry' },
    ...BUILDING_ORDER.map(type => ({ kind: 'building', type }) as const),
    ...state.ships.map(s => ({ kind: 'ship', id: s.instanceId }) as const),
    ...GOODS.map(good => ({ kind: 'good', good }) as const),
    ...me.countryside.map(t => ({ kind: 'tile', id: t.instanceId }) as const),
  ];
}

describe('scene selection maps objects to legal actions only', () => {
  it.each([['3p', three], ['4p', four], ['5p', five]] as const)('%s: played object moves are reachable by clicking; objects never offer non-legal actions', (_, fixture) => {
    const created = createGame(fixture.input as unknown as CreateGameInput);
    if (!created.ok) throw Error('setup');
    let state = created.state, reached = 0;
    for (const raw of fixture.commands) {
      const command = raw as GameCommand;
      const options = describeOptions(getLegalCommands(state, command.actorId)[0]!, state);
      if (options) {
        const { actorId: _, ...played } = command;
        const byObject = targets(state, command.actorId).flatMap(t => optionsForTarget(options, t));
        // Anything an object offers is one of the engine's options.
        for (const o of byObject) expect(options).toContainEqual(o);
        const objectMove = ['choose-role', 'load'].includes(played.kind) || (played.kind === 'plant' && command.kind === 'plant' && command.choice.kind !== 'decline')
          || (command.kind === 'build' && command.purchase !== null) || (command.kind === 'trade' && command.sale !== null)
          || (command.kind === 'take-production-bonus' && command.good !== null) || (command.kind === 'use-hospital' && command.tileId !== null);
        if (objectMove) { expect(byObject.some(o => isDeepStrictEqual(o.action, played))).toBe(true); reached++; }
      }
      const r = applyCommand(state, command);
      if (!r.ok) throw Error(r.error.message);
      state = r.state;
    }
    expect(reached).toBeGreaterThan(50);
  });

  it('an object without a legal action offers none (a sold-out building, another seat’s turn)', () => {
    const options = [{ label: '建造 小市场', action: { kind: 'build', purchase: { buildingTypeId: 'small-market', useAdvantage: false, useSchool: false } } }] as never;
    expect(optionsForTarget(options, { kind: 'building', type: 'city-hall' })).toEqual([]);
    expect(optionsForTarget([], { kind: 'role', id: 'role-1' })).toEqual([]);
  });
});

describe('action panel', () => {
  it('lists the selected object’s actions, submits through the command channel, then clears', () => {
    const submit = vi.fn(), clear = vi.fn();
    const option = { label: '选择角色 建筑师（0 金币，role-3）', action: { kind: 'choose-role', roleCardId: 'role-3' } } as never;
    render(<ActionPanel target={{ kind: 'role', id: 'role-3' }} options={[option]} submit={submit} clear={clear} />);
    fireEvent.click(screen.getByText('选择角色 建筑师（0 金币，role-3）'));
    expect(submit).toHaveBeenCalledWith(option);
    expect(clear).toHaveBeenCalled();
  });

  it('says so when the selected object has nothing to do, and renders nothing without a selection', () => {
    const { container, rerender } = render(<ActionPanel target={null} options={[]} submit={vi.fn()} clear={vi.fn()} />);
    expect(container.innerHTML).toBe('');
    rerender(<ActionPanel target={{ kind: 'quarry' }} options={[]} submit={vi.fn()} clear={vi.fn()} />);
    expect(screen.getByText('此对象当前没有可执行的行动')).toBeTruthy();
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['取消选择']);
  });
});
