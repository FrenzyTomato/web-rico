import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameState } from '@vibe-rico/game-engine';
import type { PlayerBroadcast, RoomState } from '@vibe-rico/protocol';
import type { LobbySocket } from '../network/socket.js';
import * as fixture from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { EN } from './en.js';
import { getLanguage, setLanguage, t } from './language.js';
import { BUILDING, PHASE, TILE } from './terms.js';
import { describeEvent } from './chronicle.js';
import { describeOptions } from '../actions/options.js';
import { buildingHint, estateHint } from '../scene/effects.js';
import { GameShell } from '../layout/GameShell.js';
import { Lobby } from '../lobby/Lobby.js';
import { createGameStore } from '../state/gameStore.js';

vi.mock('../scene/TableScene.js', () => ({ TableScene: () => null }));
vi.mock('../scene/SceneBoundary.js', () => ({ SceneBoundary: ({ children }: { children: React.ReactNode }) => children, webglAvailable: () => false }));
beforeEach(() => { localStorage.clear(); setLanguage('zh'); });
afterEach(() => { cleanup(); setLanguage('zh'); vi.restoreAllMocks(); });

function states() {
  const created = createGame(fixture.input as unknown as CreateGameInput);
  if (!created.ok) throw Error('fixture');
  let state = created.state;
  const result = [state];
  for (const command of fixture.commands) {
    const applied = applyCommand(state, command as GameCommand);
    if (!applied.ok) throw Error(applied.error.message);
    state = applied.state; result.push(state);
  }
  return result;
}
const recorded = states();
const room: RoomState = { roomCode: '123456', hostPlayerId: recorded[0]!.seatOrder[0]!, started: true,
  seats: recorded[0]!.seatOrder.map((playerId, i) => ({ playerId, displayName: String(i + 1) })) };
function game(state: GameState) {
  const actor = 'actorId' in state.phase ? state.phase.actorId : state.seatOrder[0]!;
  const send = vi.fn(() => new Promise<never>(() => {}));
  const store = createGameStore({ send });
  const snapshot: PlayerBroadcast = { protocolVersion: '1', revision: state.revision, events: [], legalActions: getLegalCommands(state, actor),
    view: { ...state, viewer: { playerId: actor, earnedVp: state.players.find(p => p.playerId === actor)!.earnedVp }, players: state.players.map(({ earnedVp: _, ...p }) => p) } };
  store.getState().receive(snapshot); store.getState().sessionReady();
  return { store, send };
}
function allText(element: HTMLElement) {
  return [element.textContent, ...Array.from(element.querySelectorAll('[aria-label], [title]')).flatMap(e => [e.getAttribute('aria-label'), e.getAttribute('title')])].join(' ');
}
function singleLanguage(text: string, locale: 'en' | 'zh') {
  // The Web Rico brand is intentionally identical in both languages.
  expect(text.replaceAll('Web Rico', '')).not.toMatch(locale === 'en' ? /\p{Script=Han}/u : /[A-Za-z]/);
}

it('has English-only translations with matching interpolation placeholders', () => {
  for (const [source, translation] of Object.entries(EN)) {
    expect(translation).not.toMatch(/\p{Script=Han}/u);
    expect(translation.match(/\{\d+\}/g)?.sort() ?? []).toEqual(source.match(/\{\d+\}/g)?.sort() ?? []);
  }
});
it('localizes every recorded decision without changing commands or making labels ambiguous', () => {
  for (const state of recorded) {
    if (!('actorId' in state.phase)) continue;
    const legal = getLegalCommands(state, state.phase.actorId)[0];
    if (!legal) continue;
    setLanguage('zh'); const zh = describeOptions(legal, state);
    setLanguage('en'); const en = describeOptions(legal, state);
    expect(en?.map(o => o.action)).toEqual(zh?.map(o => o.action));
    for (const [options, locale] of [[zh, 'zh'], [en, 'en']] as const) {
      for (const option of options ?? []) singleLanguage(option.label, locale);
      if (options) expect(new Set(options.map(o => o.label)).size).toBe(options.length);
    }
  }
});
it.each(['role-selection', 'recruiter-placement', 'builder-choice', 'trader-choice', 'captain-retention', 'game-over'] as const)(
  '%s: switches all UI and accessibility labels in both directions', async phase => {
    const state = recorded.find(s => s.phase.kind === phase)!;
    const { store } = game(state);
    const { container } = render(<GameShell store={store} roomId="test" room={room} />);
    await act(async () => {});
    singleLanguage(allText(container), 'zh');
    fireEvent.click(screen.getByRole('button', { name: '切换为英文' }));
    singleLanguage(allText(container), 'en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Web Rico');
    expect(localStorage.getItem('vibe-rico.language')).toBe('en');
    fireEvent.click(screen.getByRole('button', { name: 'Switch to Chinese' }));
    singleLanguage(allText(container), 'zh');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(store.getState().latest?.revision).toBe(state.revision);
  },
);
it('preserves a picked-up worker and open panel without submitting an action', async () => {
  const state = recorded.find(s => s.phase.kind === 'recruiter-placement')!;
  const { store, send } = game(state);
  render(<GameShell store={store} roomId="test" room={room} />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: '玩家' }));
  fireEvent.click(screen.getByRole('button', { name: '选择工人 1' }));
  expect(within(screen.getByLabelText('分配工人')).getByRole('status').textContent).toContain('已选工人');
  fireEvent.click(screen.getByRole('button', { name: '切换为英文' }));
  expect(within(screen.getByLabelText('Assign workers')).getByRole('status').textContent).toContain('Worker selected');
  expect(screen.getByLabelText('Player list').hidden).toBe(false);
  expect(send).not.toHaveBeenCalled();
  expect(store.getState().latest?.revision).toBe(state.revision);
});
it('updates an existing lobby error and preserves the typed player name', async () => {
  const socket = { connected: true, on: vi.fn(), off: vi.fn(), emitWithAck: vi.fn(async () => ({ ok: false, code: 'ROOM_NOT_FOUND' })) };
  const { container } = render(<Lobby socket={socket as unknown as LobbySocket} />);
  fireEvent.change(screen.getByLabelText('昵称'), { target: { value: '小明' } });
  fireEvent.click(screen.getByRole('button', { name: '加入房间' }));
  await act(async () => {});
  expect(screen.getByRole('alert').textContent).toContain('找不到');
  fireEvent.click(screen.getByRole('button', { name: '切换为英文' }));
  expect(screen.getByRole('alert').textContent).toBe('No room found for this invite code');
  expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe('小明');
  singleLanguage(allText(container), 'en');
});
it('switches all scene terms, effects, and mat headings while preserving user names', () => {
  for (const locale of ['en', 'zh'] as const) {
    setLanguage(locale);
    for (const type of Object.keys(BUILDING) as (keyof typeof BUILDING)[]) singleLanguage(Object.values(buildingHint(type)).join(' '), locale);
    for (const type of Object.keys(TILE) as (keyof typeof TILE)[]) singleLanguage(Object.values(estateHint(type)).join(' '), locale);
    singleLanguage(Object.values(PHASE).join(' '), locale);
    singleLanguage(t('田园') + t('城镇'), locale);
  }
  setLanguage('en'); expect(TILE.corn).toBe('Corn');
  expect(t('{0} 的回合', ['小明'])).toBe('小明’s turn');
  expect(describeEvent({ kind: 'vp-earned', quantity: 3 } as never, {})).toBe('You earned 3 points');
});
it('still switches when saving preferences is unavailable', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('storage disabled'); });
  setLanguage('en'); expect(getLanguage()).toBe('en'); expect(document.documentElement.lang).toBe('en');
});
