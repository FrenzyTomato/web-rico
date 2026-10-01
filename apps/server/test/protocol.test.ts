import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { BuildingType, Good } from '@vibe-rico/game-engine';
import { BUILDING_TYPES, GOODS, PROTOCOL_VERSION, parseGameplayRequest, parseRoomRequest } from '@vibe-rico/protocol';
import type { GameplayRequest, PlayerAction } from '@vibe-rico/protocol';
import { createApp, MAX_MESSAGE_BYTES } from '../src/app.js';

const request = (action: unknown, extra: Record<string, unknown> = {}) =>
  ({ protocolVersion: PROTOCOL_VERSION, roomId: 'room-1', commandId: 'c-1', expectedRevision: 3, action, ...extra });
// One valid action per engine command kind.
const actions: PlayerAction[] = [
  { kind: 'choose-role', roleCardId: 'role-1' as never },
  { kind: 'use-hacienda', accept: true },
  { kind: 'plant', choice: { kind: 'estate', tileId: 'tile-1' as never } },
  { kind: 'plant', choice: { kind: 'quarry' } },
  { kind: 'plant', choice: { kind: 'decline' } },
  { kind: 'use-hospital', tileId: null },
  { kind: 'recruit-worker', accept: false },
  { kind: 'allocate-workers', allocation: { countryside: [{ tileId: 'tile-1' as never, occupied: true }],
    buildings: [{ buildingId: 'b-1' as never, occupiedSlots: 1 }], idleCount: 0 } },
  { kind: 'build', purchase: { buildingTypeId: 'hacienda', useAdvantage: true, useSchool: false } },
  { kind: 'build', purchase: null },
  { kind: 'produce', production: { accept: true, useFactory: false } },
  { kind: 'produce', production: { accept: false } },
  { kind: 'take-production-bonus', good: 'corn' },
  { kind: 'trade', sale: { good: 'coffee', useAdvantage: true, useSmallMarket: false, useLargeMarket: false } },
  { kind: 'load', shipment: { kind: 'cargo', shipId: 'ship-1' as never, good: 'corn' }, useHarbor: false },
  { kind: 'load', shipment: { kind: 'personal', good: 'sugar' }, useHarbor: true },
  { kind: 'decline-wharf' },
  { kind: 'retain', retained: { corn: 1, fruit: 0, sugar: 0, tobacco: 0, coffee: 0 }, warehouseTypes: [] },
  { kind: 'take-adventurer-coin', accept: true },
];

describe('protocol schemas', () => {
  it('cover every engine command kind, good and building type', () => {
    expectTypeOf<GameplayRequest['action']['kind']>().toEqualTypeOf<PlayerAction['kind']>();
    expectTypeOf<typeof GOODS[number]>().toEqualTypeOf<Good>();
    expectTypeOf<typeof BUILDING_TYPES[number]>().toEqualTypeOf<BuildingType>();
    expect(new Set(actions.map(a => a.kind)).size).toBe(14);
  });

  it.each(actions)('accepts a well-formed $kind request', action => {
    expect(parseGameplayRequest(request(action))).toEqual({ ok: true, value: request(action) });
  });

  it.each([
    ['non-object', 'hello'],
    ['missing action', { protocolVersion: PROTOCOL_VERSION, roomId: 'r', commandId: 'c', expectedRevision: 1 }],
    ['string revision', request(actions[0], { expectedRevision: '3' })],
    ['string boolean', request({ kind: 'use-hacienda', accept: 'yes' })],
    ['unknown good', request({ kind: 'take-production-bonus', good: 'gold' })],
    ['unknown command kind', request({ kind: 'teleport' })],
    ['numeric protocol version', request(actions[0], { protocolVersion: 1 })],
  ])('rejects wrong types: %s', (_, input) => {
    expect(parseGameplayRequest(input)).toEqual({ ok: false, code: 'BAD_SCHEMA' });
  });

  it('rejects unknown protocol versions explicitly', () => {
    expect(parseGameplayRequest(request(actions[0], { protocolVersion: '2' }))).toEqual({ ok: false, code: 'VERSION_MISMATCH' });
    expect(parseGameplayRequest({ protocolVersion: '2', other: 'shape' })).toEqual({ ok: false, code: 'VERSION_MISMATCH' });
    expect(parseRoomRequest({ protocolVersion: '0', action: { kind: 'create-room', displayName: 'A' } })).toEqual({ ok: false, code: 'VERSION_MISMATCH' });
  });

  it.each([
    ['trusted identity in the action', request({ kind: 'choose-role', roleCardId: 'role-1', actorId: 'p1' })],
    ['identity in the envelope', request(actions[0], { playerId: 'p1' })],
    ['Trader sale price', request({ kind: 'trade', sale: { good: 'coffee', useAdvantage: true, useSmallMarket: false, useLargeMarket: false, price: 9 } })],
    ['Builder price', request({ kind: 'build', purchase: { buildingTypeId: 'hacienda', useAdvantage: true, useSchool: false, price: 0 } })],
    ['Captain load quantity', request({ kind: 'load', shipment: { kind: 'personal', good: 'sugar' }, useHarbor: false, quantity: 8 })],
    ['Captain VP', request({ kind: 'load', shipment: { kind: 'cargo', shipId: 'ship-1', good: 'corn', vp: 5 }, useHarbor: false })],
    ['Craftsman output', request({ kind: 'produce', production: { accept: true, useFactory: false, output: { coffee: 3 } } })],
  ])('rejects forged fields: %s', (_, input) => {
    expect(parseGameplayRequest(input)).toEqual({ ok: false, code: 'BAD_SCHEMA' });
  });

  it('validates room envelopes', () => {
    for (const action of [{ kind: 'create-room', displayName: 'Ana' }, { kind: 'join-room', roomCode: 'ABCD', displayName: 'Ana' },
      { kind: 'leave-room', roomId: 'r' }, { kind: 'start-game', roomId: 'r' }, { kind: 'close-room', roomId: 'r' }]) {
      expect(parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action })).toMatchObject({ ok: true });
    }
    expect(parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action: { kind: 'join-room', roomCode: 7, displayName: 'Ana' } })).toEqual({ ok: false, code: 'BAD_SCHEMA' });
    // Display names are required: empty or whitespace-only names are rejected.
    for (const displayName of ['', '   ']) {
      expect(parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action: { kind: 'create-room', displayName } })).toEqual({ ok: false, code: 'BAD_SCHEMA' });
      expect(parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action: { kind: 'join-room', roomCode: 'ABCD', displayName } })).toEqual({ ok: false, code: 'BAD_SCHEMA' });
    }
    expect(parseRoomRequest({ protocolVersion: PROTOCOL_VERSION, action: { kind: 'start-game', roomId: 'r', seatOrder: ['p1'] } })).toEqual({ ok: false, code: 'BAD_SCHEMA' });
  });
});

describe('server entry point', () => {
  let close = async () => {};
  let client: Socket | undefined;
  afterEach(async () => { client?.disconnect(); await close(); });
  async function start() {
    const { app } = createApp();
    await app.listen({ host: '127.0.0.1', port: 0 });
    close = () => app.close();
    const address = app.server.address();
    if (!address || typeof address === 'string') throw Error('no port');
    client = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'] });
    await new Promise<void>(resolve => client!.on('connect', () => resolve()));
    return { app, client };
  }

  it('health check succeeds', async () => {
    const { app } = createApp();
    close = () => app.close();
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('answers each command on its acknowledgement', async () => {
    const { client } = await start();
    expect(await client.emitWithAck('command', request(actions[0]))).toEqual({ commandId: 'c-1', code: 'UNAUTHORIZED' });
    expect(await client.emitWithAck('command', request(actions[0], { expectedRevision: 'x' }))).toEqual({ commandId: 'c-1', code: 'BAD_SCHEMA' });
    expect(await client.emitWithAck('command', { junk: true })).toEqual({ commandId: null, code: 'BAD_SCHEMA' });
    expect(await client.emitWithAck('command', request(actions[0], { protocolVersion: '9' }))).toEqual({ commandId: 'c-1', code: 'VERSION_MISMATCH' });
  });

  it('closes the connection on an oversized payload', async () => {
    const { client } = await start();
    // Just under the limit is still answered.
    expect(await client.emitWithAck('command', request(actions[0], { roomId: 'x'.repeat(MAX_MESSAGE_BYTES - 1024) })))
      .toEqual({ commandId: 'c-1', code: 'UNAUTHORIZED' });
    const reason = new Promise<string>(resolve => client.on('disconnect', resolve));
    client.emit('command', request(actions[0], { roomId: 'x'.repeat(MAX_MESSAGE_BYTES) }));
    expect(await reason).toBe('transport close');
  });
});

describe('production web client serving (PR-061)', () => {
  it('serves the built client from the same origin, and nothing outside its root', async () => {
    const { mkdtempSync, writeFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');
    const root = mkdtempSync(join(tmpdir(), 'web-'));
    writeFileSync(join(root, 'index.html'), '<title>波多黎各</title>');
    const { app } = createApp({ webRoot: root });
    await app.ready();
    const page = await app.inject({ method: 'GET', url: '/' });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain('波多黎各');
    expect((await app.inject({ method: 'GET', url: '/../../etc/passwd' })).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/health' })).json()).toEqual({ status: 'ok' });
    await app.close();
  });
});
