import { expect, it } from 'vitest';
import { applyCommand, assertGameState } from '@vibe-rico/game-engine';
import { initialTutorialGame, nextTutorialCommand, tutorialComplete } from '../../web/src/tutorial/scenario.js';
import { tutorialBroadcast } from '../../web/src/tutorial/projection.js';
import { broadcastFor } from '../src/rooms/broadcast.js';

it('plays every move continuously through shipping follow-ups with the real engine', () => {
  let game = initialTutorialGame();
  const moves = [];
  for (let i = 0; i < 100; i++) {
    const command = nextTutorialCommand(game);
    if (!command) break;
    const result = applyCommand(game, command);
    if (!result.ok) throw Error(`${JSON.stringify(command)}: ${result.error.message}`);
    expect(result.state.revision).toBe(game.revision + 1);
    game = result.state; assertGameState(game);
    expect(tutorialBroadcast(game, result.events)).toEqual(broadcastFor(game, result.events, game.seatOrder[0]!));
    moves.push(command);
  }
  expect(tutorialComplete(game)).toBe(true);
  expect(moves.filter(c => c.kind === 'choose-role')).toHaveLength(8);
  expect(moves.filter(c => c.kind === 'choose-role' && c.actorId === 'alice')).toHaveLength(3);
  for (const actor of game.seatOrder) {
    expect(moves.some(c => c.actorId === actor && c.kind === 'allocate-workers')).toBe(true);
    expect(moves.some(c => c.actorId === actor && c.kind === 'load')).toBe(true);
    expect(game.players.find(p => p.playerId === actor)!.buildings.length).toBeGreaterThan(0);
  }
  expect(game.players[0]!.earnedVp).toBe(2);
  expect(game.phase.kind).toBe('role-selection');
});
