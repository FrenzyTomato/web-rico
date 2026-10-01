import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { applyCommand, createGame, getLegalCommands } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameEvent, GameState } from '@vibe-rico/game-engine';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { SeatGranted } from '@vibe-rico/protocol';
import * as three from '../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import * as four from '../../../packages/game-engine/test/scenarios/fixtures/full-game-4p.js';
import * as five from '../../../packages/game-engine/test/scenarios/fixtures/full-game-5p.js';
import { createApp } from '../src/app.js';
import { broadcastFor } from '../src/rooms/broadcast.js';

/** Every revision of a frozen PR-036 full game, with the events that produced it. */
function revisions(fixture: { input: unknown; commands: readonly unknown[] }) {
  const created = createGame(fixture.input as CreateGameInput);
  if (!created.ok) throw Error(created.error.message);
  const out: { state: GameState; events: readonly GameEvent[] }[] = [{ state: created.state, events: [] }];
  for (const command of fixture.commands) {
    const result = applyCommand(out.at(-1)!.state, command as GameCommand);
    if (!result.ok) throw Error(result.error.message);
    out.push({ state: result.state, events: result.events });
  }
  return out;
}

const SUPPLY_KEYS = ['buildingStock', 'goods', 'quarryCount', 'vpOverflow', 'vpRemaining', 'workRegisterCount', 'workerCount'];
const TURN = ['actorId', 'actorIndex', 'kind', 'roleChooserId'];
const PHASE_KEYS: Record<string, string[]> = {
  'role-selection': ['actorId', 'kind'], 'planter-before': TURN, 'recruiter-advantage': TURN, 'recruiter-placement': TURN,
  'builder-choice': TURN, 'trader-choice': TURN, 'captain-retention': TURN, adventurer: TURN,
  'planter-choice': [...TURN, 'acquiredTileIds'].sort(), 'planter-worker': [...TURN, 'acquiredTileIds'].sort(),
  'craftsman-production': [...TURN, 'chooserProducedTypes'].sort(), 'craftsman-bonus': [...TURN, 'chooserProducedTypes'].sort(),
  'captain-loading': [...TURN, 'captainBonusUsed', 'consecutiveNoLoads'].sort(), 'game-over': ['kind', 'scores'],
};

describe('TS-PRIVACY: projections over complete games', () => {
  it.each([['3p', three], ['4p', four], ['5p', five]] as const)('%s: every seat’s messages hide VP, bag, RNG and others’ choices', (_, fixture) => {
    let othersVpEvents = 0, placements = 0;
    for (const { state, events } of revisions(fixture)) {
      const over = state.phase.kind === 'game-over';
      for (const seat of state.seatOrder) {
        const message = broadcastFor(state, events, seat);
        const json = JSON.stringify(message);
        // PRIV-01: only the viewer's own earned VP, and only their own vp-earned events.
        expect(message.view.viewer).toEqual({ playerId: seat, earnedVp: state.players.find(p => p.playerId === seat)!.earnedVp });
        expect(message.view.players.every(p => !('earnedVp' in p))).toBe(true);
        expect(message.events.filter(e => e.kind === 'vp-earned' && e.playerId !== seat)).toEqual([]);
        othersVpEvents += events.filter(e => e.kind === 'vp-earned' && e.playerId !== seat).length;
        // PRIV-02: no current bag tile, by ID; placed tiles are public once placed.
        for (const tile of state.estateBag) expect(json).not.toContain(`"${tile.instanceId}"`);
        placements += message.events.filter(e => e.kind === 'tile-placed').length;
        // PRIV-03: no RNG object or state words.
        expect(json).not.toContain('"rng"');
        for (const word of state.rng.state) expect(json).not.toContain(String(word));
        // PRIV-04: legal actions only for the decision-maker, exactly as the engine offers them.
        expect(message.legalActions).toEqual(getLegalCommands(state, seat));
        if ('actorId' in state.phase && state.phase.actorId !== seat) expect(message.legalActions).toEqual([]);
        // AUD-04: the VP supply is public (VISIBILITY-001), as in the physical game; inference is accepted (VISIBILITY-003).
        expect(message.view.supply.vpRemaining).toBe(state.supply.vpRemaining);
        // AUD-05: nested objects pass through by reference, so pin their key sets; a new hidden field fails here.
        expect(Object.keys(message.view.supply).sort()).toEqual(SUPPLY_KEYS);
        expect(Object.keys(message.view.phase).sort()).toEqual(PHASE_KEYS[message.view.phase.kind]);
        // VISIBILITY-002: game over reveals every breakdown to everyone.
        if (over && state.phase.kind === 'game-over') expect(message.view.phase).toEqual(state.phase);
      }
    }
    // The checks were exercised: opponents did earn VP, and estates were placed.
    expect(othersVpEvents).toBeGreaterThan(0);
    expect(placements).toBeGreaterThan(0);
  });
});

describe('TS-PRIVACY: messages across independent connections', () => {
  let cleanup: (() => Promise<void>)[] = [];
  afterEach(async () => { for (const c of cleanup.reverse()) await c(); cleanup = []; });

  async function recorded() {
    const { app } = createApp();
    await app.listen({ host: '127.0.0.1', port: 0 });
    cleanup.push(() => app.close());
    const address = app.server.address();
    if (!address || typeof address === 'string') throw Error('no port');
    const client = async () => {
      const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
      const inbox: { event: string; args: unknown[] }[] = [];
      socket.onAny((event: string, ...args: unknown[]) => inbox.push({ event, args }));
      cleanup.push(async () => { socket.disconnect(); });
      await new Promise<void>(resolve => socket.on('connect', () => resolve()));
      return { socket, inbox };
    };
    return { app, client };
  }
  const room = (s: Socket, action: object) => s.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });
  const settle = () => new Promise(resolve => setTimeout(resolve, 50));

  it('each connection receives only its own projection; tokens, rejections and full state never reach others', async () => {
    const { app, client } = await recorded();
    const tabs = [await client(), await client(), await client()];
    const granted: SeatGranted[] = [(await room(tabs[0]!.socket, { kind: 'create-room', displayName: 'A' })).value];
    for (const t of tabs.slice(1)) granted.push((await room(t.socket, { kind: 'join-room', roomCode: granted[0]!.roomCode, displayName: 'B' })).value);
    const roomId = granted[0]!.roomId;
    expect(await room(tabs[0]!.socket, { kind: 'start-game', roomId })).toEqual({ ok: true, value: null });
    await settle();
    const states = (t: { inbox: { event: string; args: unknown[] }[] }) => t.inbox.filter(m => m.event === 'state').map(m => m.args[0]);
    // Every seat got the start view, addressed to itself, and the public seat list (names, no token hashes).
    for (const [i, t] of tabs.entries()) {
      expect(states(t)).toHaveLength(1);
      expect(states(t)[0]).toMatchObject({ revision: 0, view: { viewer: { playerId: granted[i]!.playerId } }, events: [] });
      const seats = t.inbox.filter(m => m.event === 'room-state').at(-1)!.args[0];
      expect(seats).toEqual({ roomCode: granted[0]!.roomCode, hostPlayerId: granted[0]!.playerId, started: true,
        seats: granted.map((g, n) => ({ playerId: g.playerId, displayName: n === 0 ? 'A' : 'B' })) });
    }
    // The Governor is the only seat with legal actions; it chooses a role.
    const governor = tabs.findIndex(t => (states(t)[0] as { legalActions: unknown[] }).legalActions.length > 0);
    const roleCardId = (states(tabs[governor]!)[0] as { legalActions: { roleCardIds: string[] }[] }).legalActions[0]!.roleCardIds[0]!;
    const other = (governor + 1) % 3;
    const before = tabs.map(t => t.inbox.length);
    // PRIV-05: a rejection is only the submitter's acknowledgement; nobody else hears of it.
    expect(await tabs[other]!.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'bad', expectedRevision: 0,
      action: { kind: 'choose-role', roleCardId } })).toEqual({ commandId: 'bad', code: 'ILLEGAL_COMMAND', ruleId: 'ROLE-001' });
    await settle();
    expect(tabs.map(t => t.inbox.length)).toEqual(before);
    expect(await tabs[governor]!.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'ok', expectedRevision: 0,
      action: { kind: 'choose-role', roleCardId } })).toEqual({ commandId: 'ok', acceptedRevision: 1 });
    await settle();
    for (const [i, t] of tabs.entries()) {
      const last = states(t).at(-1) as { revision: number; view: { viewer: { playerId: string } }; events: GameEvent[] };
      expect(last).toMatchObject({ revision: 1, view: { viewer: { playerId: granted[i]!.playerId } } });
      expect(last.events[0]).toMatchObject({ kind: 'role-selected' });
    }
    // A takeover moves the seat's messages to the new connection; resume sends the current view.
    const newTab = await client();
    await newTab.socket.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId, token: granted[other]!.token });
    await settle();
    expect(states(newTab)[0]).toMatchObject({ revision: 1, view: { viewer: { playerId: granted[other]!.playerId } } });
    const oldTabCount = tabs[other]!.inbox.length;
    await tabs[governor]!.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'plant', expectedRevision: 1,
      action: { kind: 'plant', choice: { kind: 'decline' } } });
    await settle();
    expect(tabs[other]!.inbox.slice(oldTabCount).map(m => m.event)).toEqual([]);
    expect(states(newTab).at(-1)).toMatchObject({ revision: 2 });
    // PRIV-03/06: no RNG, token or token hash in any message any connection received (grants are acknowledgements, not inbox events).
    const secrets = granted.flatMap(g => [g.token, createHash('sha256').update(g.token).digest('hex')]);
    for (const t of [...tabs, newTab]) {
      const all = JSON.stringify(t.inbox);
      expect(all).not.toContain('"rng"');
      expect(all).not.toContain('"estateBag"');
      expect(all).not.toContain('tokenHash');
      for (const secret of secrets) expect(all).not.toContain(secret);
    }
    // PRIV-07: the only HTTP route is the health check; no developer snapshot endpoint exists.
    for (const url of ['/state', '/snapshot', '/debug', '/dev/state']) expect((await app.inject({ method: 'GET', url })).statusCode).toBe(404);
  });
});
