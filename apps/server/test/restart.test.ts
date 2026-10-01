import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import postgres from 'postgres';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { PROTOCOL_VERSION } from '@vibe-rico/protocol';
import type { PlayerBroadcast, SeatGranted } from '@vibe-rico/protocol';

// TS-DURABLE with real process restarts (run via `pnpm --filter @vibe-rico/server test:db`).
const url = process.env.DATABASE_URL;
const PORT = 3911, base = `http://127.0.0.1:${PORT}`;
let server: ChildProcess | undefined;

async function start(script: string) {
  server = spawn(process.execPath, [script], { env: { ...process.env, PORT: String(PORT), DATABASE_URL: url }, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* starting */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error('server did not start');
}
async function kill() {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise(r => server!.once('exit', r));
  server.kill('SIGKILL');
  await exited;
}
async function client() {
  const socket = connect(base, { transports: ['websocket'], forceNew: true, reconnection: false });
  const states: PlayerBroadcast[] = [];
  socket.on('state', (b: PlayerBroadcast) => states.push(b));
  await new Promise<void>(resolve => socket.on('connect', () => resolve()));
  return { socket, states };
}
const room = (s: Socket, action: object) => s.emitWithAck('room', { protocolVersion: PROTOCOL_VERSION, action });
const resume = (s: Socket, roomId: string, token: string) => s.emitWithAck('resume', { protocolVersion: PROTOCOL_VERSION, roomId, token });
/** The first legal choice for the seat whose latest view offers one (role card, then first planting choice). */
function firstChoice(latest: PlayerBroadcast) {
  const legal = latest.legalActions[0] as { phase: string; roleCardIds?: string[]; choices?: unknown[] };
  return legal.phase === 'role-selection' ? { kind: 'choose-role', roleCardId: legal.roleCardIds![0] } : { kind: 'plant', choice: legal.choices![0] };
}
const settle = () => new Promise(r => setTimeout(r, 150));

describe.skipIf(!url)('restart recovery', () => {
  beforeAll(async () => {
    const sql = postgres(url!, { onnotice: () => {} });
    await sql`drop schema if exists public cascade`; await sql`drop schema if exists drizzle cascade`; await sql`create schema public`;
    await sql.end();
  });
  afterAll(kill);

  it('after real restarts, the same token resumes; a command whose ack was lost in a crash is not applied twice', async () => {
    // 1. Normal server: three seats, start, the Governor's first move.
    await start('dist/main.js');
    const seats = [await client(), await client(), await client()];
    const host: { value: SeatGranted } = await room(seats[0]!.socket, { kind: 'create-room', displayName: 'A' });
    const granted = [host.value];
    for (const s of seats.slice(1)) granted.push((await room(s.socket, { kind: 'join-room', roomCode: host.value.roomCode, displayName: 'B' })).value);
    await room(seats[0]!.socket, { kind: 'start-game', roomId: host.value.roomId });
    await settle();
    const roomId = host.value.roomId;
    const actorAt = () => seats.findIndex(s => s.states.at(-1)!.legalActions.length > 0);
    const g = actorAt();
    expect(await seats[g]!.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'c1', expectedRevision: 0, action: firstChoice(seats[g]!.states.at(-1)!) }))
      .toEqual({ commandId: 'c1', acceptedRevision: 1 });

    // 2. Real crash, then a server that dies right after committing the next command (before acknowledging).
    for (const s of seats) s.socket.disconnect();
    await kill();
    await start('test/fixtures/crash-server.mjs');
    const resumed = await Promise.all(granted.map(async g2 => {
      const c = await client();
      return { c, reply: await resume(c.socket, roomId, g2.token) };
    }));
    for (const r of resumed) expect(r.reply).toMatchObject({ ok: true, value: { revision: 1 } });
    await settle();
    const next = resumed.findIndex(r => r.c.states.at(-1)!.legalActions.length > 0);
    const c2 = { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'c2', expectedRevision: 1, action: firstChoice(resumed[next]!.c.states.at(-1)!) };
    await expect(resumed[next]!.c.socket.timeout(2000).emitWithAck('command', c2)).rejects.toThrow();
    expect(server!.exitCode ?? (await new Promise(r => server!.once('exit', r)))).toBe(70);

    // 3. Normal restart: the committed command survived; its retry returns the saved result, no second transition.
    await start('dist/main.js');
    const again = await client();
    expect(await resume(again.socket, roomId, granted[next]!.token)).toMatchObject({ ok: true, value: { revision: 2 } });
    expect(await again.socket.emitWithAck('command', c2)).toEqual({ commandId: 'c2', acceptedRevision: 2 });
    const others = await Promise.all([1, 2].map(async k => {
      const c = await client();
      expect(await resume(c.socket, roomId, granted[(next + k) % 3]!.token)).toMatchObject({ ok: true, value: { revision: 2 } });
      return c;
    }));
    // No action lost during recovery: with all seats resumed, the next move after restart reaches everyone.
    await settle();
    const all = [again, ...others];
    const mover = all.find(s => s.states.at(-1)!.legalActions.length > 0)!;
    expect(mover).toBeDefined();
    expect(await mover.socket.emitWithAck('command', { protocolVersion: PROTOCOL_VERSION, roomId, commandId: 'c3', expectedRevision: 2, action: firstChoice(mover.states.at(-1)!) }))
      .toEqual({ commandId: 'c3', acceptedRevision: 3 });
    await settle();
    for (const s of all) expect(s.states.at(-1)!.revision).toBe(3);
    for (const s of [...resumed.map(r => r.c), ...all]) s.socket.disconnect();
  });
});
