import { describe, expect, it } from 'vitest';
import { MAX_CALLS } from '../../src/bots/decide.js';
import { FakeClient, playBots } from './helpers.js';

describe('bots play whole games', () => {
  for (const players of [3, 4, 5]) it(`${players} bots on the code value alone reach the end`, async () => {
    const { state, maxCalls } = await playBots(players, null);
    expect(state.phase.kind).toBe('game-over');
    expect(maxCalls).toBe(0);
  }, 60_000);
  it('with a decision client, never more than 3 calls per turn, and each bot picks a plan', async () => {
    const client = new FakeClient();
    const { state, maxCalls, memory } = await playBots(3, client);
    expect(state.phase.kind).toBe('game-over');
    expect(maxCalls).toBeLessThanOrEqual(MAX_CALLS);
    expect([...memory.values()].every(m => m.strategy)).toBe(true);
    for (const qs of client.questions) for (const q of Object.values(qs)) expect(Object.keys(q.criteria).length).toBeLessThanOrEqual(12);
  }, 60_000);
});
