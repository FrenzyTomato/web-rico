import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import { createApp } from '../src/app.js';
import { supabaseAccounts } from '../src/accounts/supabase.js';
import { InMemoryRoomStore } from '../src/rooms/inMemoryStore.js';

const URL = 'https://test-project.supabase.co';
const { publicKey, privateKey } = await generateKeyPair('ES256');
const keys = createLocalJWKSet({ keys: [{ ...(await exportJWK(publicKey)), kid: 'test', alg: 'ES256' }] });
/** An access token as Supabase would sign it. */
const token = (sub: string, { issuer = `${URL}/auth/v1`, expires = '1h', key = privateKey } = {}) =>
  new SignJWT({ role: 'authenticated' }).setProtectedHeader({ alg: 'ES256', kid: 'test' }).setSubject(sub)
    .setIssuer(issuer).setAudience('authenticated').setIssuedAt().setExpirationTime(expires).sign(key);

let cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const c of cleanup.reverse()) await c(); cleanup = []; });

async function server() {
  const deleted: string[] = [];
  const fetchImpl = vi.fn(async (url: string) => { deleted.push(String(url)); return new Response(null, { status: 200 }); }) as unknown as typeof fetch;
  const accounts = supabaseAccounts({ url: URL, serviceRoleKey: 'service-key', keys, fetchImpl });
  const store = new InMemoryRoomStore();
  const { app } = createApp({ store, accounts });
  await app.listen({ host: '127.0.0.1', port: 0 });
  cleanup.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw Error('no port');
  const client = async () => {
    const socket = connect(`http://127.0.0.1:${address.port}`, { transports: ['websocket'], forceNew: true });
    cleanup.push(async () => { socket.disconnect(); });
    await new Promise<void>(resolve => socket.on('connect', () => resolve()));
    return socket;
  };
  return { client, store, deleted };
}
const auth = (s: Socket, accessToken: string | null) => s.emitWithAck('auth', { protocolVersion: PROTOCOL_VERSION, accessToken });
const room = (s: Socket, action: object) => s.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });

describe('token verification', () => {
  const accounts = supabaseAccounts({ url: URL, keys });
  it('accepts a Supabase-signed token and rejects tampered, expired or foreign ones', async () => {
    expect(await accounts.verify(await token('user-1'))).toMatchObject({ userId: 'user-1' });
    expect(await accounts.verify(await token('user-1', { expires: '-1m' }))).toBeNull();
    expect(await accounts.verify(await token('user-1', { issuer: 'https://evil.example/auth/v1' }))).toBeNull();
    expect(await accounts.verify(await token('user-1', { key: (await generateKeyPair('ES256')).privateKey }))).toBeNull();
    expect(await accounts.verify('not-a-token')).toBeNull();
  });
  it('supports legacy shared-secret projects', async () => {
    const secret = 'legacy-secret-legacy-secret-legacy';
    const legacy = supabaseAccounts({ url: URL, jwtSecret: secret });
    const signed = await new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject('user-2').setIssuer(`${URL}/auth/v1`)
      .setAudience('authenticated').setExpirationTime('1h').sign(new TextEncoder().encode(secret));
    expect(await legacy.verify(signed)).toMatchObject({ userId: 'user-2' });
  });
});

describe('accounts over the socket', () => {
  it('a signed-in player sees their games and rejoins from another device, which takes the seat over', async () => {
    const { client, store } = await server();
    const phone = await client();
    expect(await auth(phone, await token('ana'))).toEqual({ ok: true, value: { signedIn: true } });
    const created = await room(phone, { kind: 'create-room', displayName: 'Ana' });
    expect((await store.get(created.value.roomId))!.room.seats[0]!.userId).toBe('ana');

    const laptop = await client();
    expect(await room(laptop, { kind: 'my-games' })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    await auth(laptop, await token('ana'));
    expect(await room(laptop, { kind: 'my-games' })).toEqual({ ok: true, value: [
      { roomId: created.value.roomId, roomCode: created.value.roomCode, status: 'lobby', players: ['Ana'], you: 'Ana', round: null }] });
    const replaced = new Promise(resolve => phone.once('session-replaced', resolve));
    const rejoined = await room(laptop, { kind: 'resume-account', roomId: created.value.roomId });
    expect(rejoined).toMatchObject({ ok: true, value: { roomId: created.value.roomId, playerId: created.value.playerId } });
    await replaced;
    // The phone's stored token no longer resumes; the new one does.
    const old = await client();
    expect(await old.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId: created.value.roomId, token: created.value.token })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await old.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId: created.value.roomId, token: rejoined.value.token })).toMatchObject({ ok: true });
  });

  it('another account cannot rejoin a seat it does not own', async () => {
    const { client } = await server();
    const ana = await client();
    await auth(ana, await token('ana'));
    const created = await room(ana, { kind: 'create-room', displayName: 'Ana' });
    const bo = await client();
    await auth(bo, await token('bo'));
    expect(await room(bo, { kind: 'resume-account', roomId: created.value.roomId })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    expect(await room(bo, { kind: 'my-games' })).toEqual({ ok: true, value: [] });
  });

  it('a guest seat can be saved to an account after signing in', async () => {
    const { client, store } = await server();
    const guest = await client();
    const created = await room(guest, { kind: 'create-room', displayName: 'Guest' });
    expect(await room(guest, { kind: 'claim-seat', roomId: created.value.roomId })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    await auth(guest, await token('cai'));
    expect(await room(guest, { kind: 'claim-seat', roomId: created.value.roomId })).toEqual({ ok: true, value: null });
    expect((await store.get(created.value.roomId))!.room.seats[0]!.userId).toBe('cai');
  });

  it('rejects a bad token, and signing out drops the account from the connection', async () => {
    const { client } = await server();
    const s = await client();
    expect(await auth(s, 'forged')).toEqual({ ok: false, code: 'UNAUTHORIZED' });
    await auth(s, await token('dee'));
    expect(await auth(s, null)).toEqual({ ok: true, value: { signedIn: false } });
    expect(await room(s, { kind: 'my-games' })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
  });

  it('deleting an account unlinks its seats and removes the Supabase user', async () => {
    const { client, store, deleted } = await server();
    const s = await client();
    await auth(s, await token('eve'));
    const created = await room(s, { kind: 'create-room', displayName: 'Eve' });
    expect(await room(s, { kind: 'delete-account' })).toEqual({ ok: true, value: null });
    expect((await store.get(created.value.roomId))!.room.seats[0]!.userId).toBeUndefined();
    expect(deleted).toEqual([`${URL}/auth/v1/admin/users/eve`]);
    expect(await room(s, { kind: 'my-games' })).toEqual({ ok: false, code: 'UNAUTHORIZED' });
  });
});
