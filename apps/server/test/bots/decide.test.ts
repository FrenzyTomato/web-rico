import { describe, expect, it } from 'vitest';
import { applyCommand, createGame } from '@vibe-rico/game-engine';
import type { GameCommand, GameState, PlayerId } from '@vibe-rico/game-engine';
import { commands, input } from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import { decide, freshMemory, MAX_CALLS } from '../../src/bots/decide.js';
import type { BotMemory } from '../../src/bots/decide.js';
import { buildingVp } from '../../src/bots/facts.js';
import type { AcceptedCommand } from '../../src/rooms/store.js';
import { FakeClient } from './helpers.js';

/** Replays the engine's fixed 3-player game to its 31st role choice (round 11, bruno to choose), with history. */
function position() {
  const created = createGame(input as never);
  if (!created.ok) throw Error('setup');
  let state = created.state;
  const history: AcceptedCommand[] = [];
  let choices = 0;
  for (const [i, c] of (commands as GameCommand[]).entries()) {
    if (state.phase.kind === 'role-selection' && choices++ === 30) break;
    const r = applyCommand(state, c);
    if (!r.ok) throw Error(r.error.message);
    history.push({ playerId: c.actorId, commandId: `c${i}`, expectedRevision: state.revision, action: c as never, acceptedRevision: r.state.revision, events: r.events });
    state = r.state;
  }
  return { state, history };
}
const names = { alice: 'alice', bruno: 'bruno', chen: 'chen' };
const me = 'bruno' as PlayerId;
/** Gives a player goods and VP while keeping the engine's ledgers balanced. */
function give(s: GameState, id: string, goods: Partial<Record<string, number>>, vp = 0): GameState {
  const next = structuredClone(s) as unknown as { players: { playerId: string; goods: Record<string, number>; earnedVp: number }[]; supply: { goods: Record<string, number>; vpRemaining: number } };
  const p = next.players.find(x => x.playerId === id)!;
  for (const [g, n] of Object.entries(goods)) { p.goods[g]! += n!; next.supply.goods[g]! -= n!; }
  p.earnedVp += vp; next.supply.vpRemaining -= vp;
  return next as unknown as GameState;
}

describe('bot decisions', () => {
  it('sends only public facts: opponents are scored by buildings plus barrels shipped, never their VP chips', async () => {
    const { state, history } = position();
    const client = new FakeClient();
    await decide({ state, history, me, names, memory: freshMemory(), client });
    const sent = client.states[0] as { players: { name: string; publicVp: number; shippedBarrels?: number }[] };
    const chen = state.players.find(p => p.playerId === 'chen')!;
    const barrels = history.flatMap(c => c.events).filter(e => e.kind === 'goods-moved' && e.from.kind === 'player' && e.from.playerId === 'chen'
      && (e.to.kind === 'cargo-ship' || e.to.kind === 'personal-ship')).reduce((a, e) => a + (e as { quantity: number }).quantity, 0);
    expect(sent.players.find(p => p.name === 'chen')!.publicVp).toBe(buildingVp(chen) + barrels);
    expect(JSON.stringify(client.states)).not.toContain('earnedVp');
  });

  it('does not take the Captain when only the leader would ship', async () => {
    const { state, history } = position();
    const s = give(state, 'chen', { corn: 6 }, 15);
    const decision = await decide({ state: s, history, me, names, memory: freshMemory(), client: null });
    expect(decision!.trace.key).not.toBe('captain');
    expect(decision!.trace.scores.captain!.value).toBeLessThan(decision!.trace.scores.craftsman!.value);
  });

  it('takes the Trader when it can sell coffee into an empty trading house', async () => {
    const { state, history } = position();
    const s = { ...give(state, 'bruno', { coffee: 2 }), tradingHouse: [] } as GameState;
    // Put the trading house goods back into supply so the ledgers balance.
    const fixed = structuredClone(s) as unknown as { supply: { goods: Record<string, number> } };
    for (const g of state.tradingHouse) fixed.supply.goods[g]!++;
    const decision = await decide({ state: fixed as unknown as GameState, history, me, names, memory: freshMemory(), client: null });
    expect(decision!.trace.key).toBe('trader');
  });

  it('keeps the posture Jev judges, with no lead rule in code', async () => {
    const { state, history } = position();
    const client = new FakeClient(id => id === 'posture' ? { build: 0.8, race: 0.05, block: 0.1, stall: 0.05 } : undefined);
    // bruno trails chen by a lot, yet the judged posture stands.
    const decision = await decide({ state: give(state, 'chen', {}, 20), history, me, names, memory: freshMemory(), client });
    const p = decision!.memory.posture;
    expect(p.build).toBeGreaterThan(Math.max(p.race, p.block, p.stall));
  });

  it('picks its own plan and switches only past the margin', async () => {
    const { state, history } = position();
    let own: Record<string, number> = { shipper: 0.6, trader: 0.2, builder: 0.1, balanced: 0.1 };
    const client = new FakeClient(id => id === 'own' ? own : undefined);
    const run = async (memory: BotMemory, round: number) => (await decide({ state: { ...state, roundNumber: round }, history, me, names, memory, client }))!.memory;
    let memory = await run(freshMemory(), 11);
    expect(memory.strategy).toBe('shipper');
    own = { shipper: 0.35, trader: 0.45, builder: 0.1, balanced: 0.1 };
    memory = await run({ ...memory, readAt: 0 }, 12);
    expect(memory.strategy).toBe('shipper');
    own = { shipper: 0.15, trader: 0.7, builder: 0.1, balanced: 0.05 };
    memory = await run({ ...memory, readAt: 0 }, 13);
    expect(memory.strategy).toBe('trader');
  });

  it('splits a large build choice into kind then building, within the call budget', async () => {
    const { state, history } = position();
    const rich = structuredClone(state) as unknown as { players: { playerId: string; coins: number }[] };
    rich.players.find(p => p.playerId === 'bruno')!.coins = 30;
    let s = rich as unknown as GameState;
    s = (applyCommand(s, { kind: 'choose-role', actorId: me, roleCardId: s.roleCards.find(c => c.kind === 'builder')!.instanceId }) as { state: GameState }).state;
    const client = new FakeClient();
    const decision = await decide({ state: s, history, me, names, memory: freshMemory(), client });
    expect(decision!.calls).toBe(MAX_CALLS);
    expect(Object.keys(client.questions[1]!)).toEqual(['group']);
    expect(Object.keys(client.questions[2]!.move!.criteria).length).toBeLessThanOrEqual(12);
    expect(decision!.action.kind).toBe('build');
  });

  it('skips the table read when nobody else has moved since the last one', async () => {
    const { state, history } = position();
    const client = new FakeClient();
    await decide({ state, history, me, names, memory: { ...freshMemory(), readAt: history.length }, client });
    expect(client.calls).toBe(1);
    expect(Object.keys(client.questions[0]!)).toEqual(['move']);
  });
});
