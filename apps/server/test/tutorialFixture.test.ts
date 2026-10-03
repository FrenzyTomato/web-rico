import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { tutorialFixture } from './tutorialFixture.js';

it('replays the tutorial legally and matches the shipped learner-only fixture', () => {
  const steps = tutorialFixture();
  const file = new URL('../../web/src/tutorial/fixture.json', import.meta.url);
  // Explicit developer regeneration; ordinary CI only compares.
  if (process.env.UPDATE_TUTORIAL === '1') { mkdirSync(new URL('.', file), { recursive: true }); writeFileSync(file, JSON.stringify(steps)); }
  expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual(steps);
  expect(steps.map(s => s.id)).toEqual(['role', 'estate', 'build', 'workers', 'produce', 'bonus', 'trade', 'ship']);
  const trade = steps.find(s => s.id === 'trade')!;
  const player = (s: typeof trade.before) => s.view.players.find(p => p.playerId === 'alice')!;
  expect(player(trade.after).coins - player(trade.before).coins).toBe(1);
  expect(player(trade.after).goods.corn).toBe(1);
  const ship = steps.at(-1)!;
  expect(ship.after.view.viewer.earnedVp - ship.before.view.viewer.earnedVp).toBe(2);
});
