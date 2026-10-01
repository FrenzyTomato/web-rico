import { and, asc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { GameEvent, PlayerId } from '@vibe-rico/game-engine';
import type { AcceptedCommand, Room, RoomStore, StoredRoom } from '../rooms/store.js';
import * as schema from './schema.js';
import { guardSnapshot, SNAPSHOT_UPGRADES } from './versionGuard.js';
import type { SnapshotUpgrade } from './versionGuard.js';

type Db = PostgresJsDatabase<typeof schema>;
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];
const MIGRATIONS = new URL('../../drizzle', import.meta.url).pathname;
const isUniqueViolation = (e: unknown) => (e as { code?: string; cause?: { code?: string } }).code === '23505'
  || (e as { cause?: { code?: string } }).cause?.code === '23505';

/** Opens a connection pool and applies pending migrations. */
export async function connect(url: string, upgrades: Readonly<Record<string, SnapshotUpgrade>> = SNAPSHOT_UPGRADES) {
  const client = postgres(url, { max: 5, onnotice: () => {} });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: MIGRATIONS });
  return { store: new PostgresRoomStore(db, upgrades), close: () => client.end() };
}

/**
 * The RoomStore contract (rooms/store.ts) on PostgreSQL. Every write is one transaction guarded by the
 * stored revision, so a stale writer changes nothing.
 */
export class PostgresRoomStore implements RoomStore {
  constructor(private readonly db: Db, private readonly upgrades: Readonly<Record<string, SnapshotUpgrade>> = SNAPSHOT_UPGRADES) {}

  async create(room: Room): Promise<boolean> {
    try {
      await this.db.transaction(async tx => {
        await tx.insert(schema.rooms).values({ ...roomColumns(room), roomId: room.roomId, roomCode: room.roomCode, revision: 0 });
        await writeSeats(tx, room);
        await appendHistory(tx, room, []);
      });
      return true;
    } catch (e) {
      if (isUniqueViolation(e)) return false;
      throw e;
    }
  }

  async get(roomId: string): Promise<StoredRoom | undefined> {
    const [row] = await this.db.select().from(schema.rooms).where(eq(schema.rooms.roomId, roomId));
    if (!row) return undefined;
    const seats = await this.db.select().from(schema.seats).where(eq(schema.seats.roomId, roomId)).orderBy(asc(schema.seats.seatIndex));
    const commands = await this.db.select().from(schema.commands).where(eq(schema.commands.roomId, roomId)).orderBy(asc(schema.commands.acceptedRevision));
    const events = await this.db.select().from(schema.events).where(eq(schema.events.roomId, roomId)).orderBy(asc(schema.events.revision), asc(schema.events.index));
    const byRevision = new Map<number, GameEvent[]>();
    for (const e of events) byRevision.set(e.revision, [...byRevision.get(e.revision) ?? [], e.event]);
    const room: Room = {
      roomId: row.roomId, roomCode: row.roomCode, hostPlayerId: row.hostPlayerId as PlayerId,
      seats: seats.map(s => ({ playerId: s.playerId as PlayerId, displayName: s.displayName, tokenHash: s.tokenHash })),
      game: row.state === null || row.initialState === null || row.seed === null ? null : {
        // Version guard (PR-059): known upgrades in memory, then strict validation; incompatible saves throw.
        seed: row.seed, initialState: guardSnapshot(row.roomId, row.initialState, this.upgrades), state: guardSnapshot(row.roomId, row.state, this.upgrades),
        commands: commands.map(c => ({
          playerId: c.playerId as PlayerId, commandId: c.commandId, expectedRevision: c.expectedRevision,
          action: c.action as AcceptedCommand['action'], acceptedRevision: c.acceptedRevision, events: byRevision.get(c.acceptedRevision) ?? [],
        })),
      },
    };
    return { room, revision: row.revision };
  }

  async findByCode(roomCode: string): Promise<StoredRoom | undefined> {
    const [row] = await this.db.select({ roomId: schema.rooms.roomId }).from(schema.rooms).where(eq(schema.rooms.roomCode, roomCode));
    return row ? this.get(row.roomId) : undefined;
  }

  async update(room: Room, expectedRevision: number): Promise<'ok' | 'stale'> {
    return this.db.transaction(async tx => {
      const updated = await tx.update(schema.rooms).set({ ...roomColumns(room), revision: expectedRevision + 1 })
        .where(and(eq(schema.rooms.roomId, room.roomId), eq(schema.rooms.revision, expectedRevision))).returning({ roomId: schema.rooms.roomId });
      if (updated.length === 0) return 'stale';
      await tx.delete(schema.seats).where(eq(schema.seats.roomId, room.roomId));
      await writeSeats(tx, room);
      const stored = await tx.select({ playerId: schema.commands.playerId, commandId: schema.commands.commandId })
        .from(schema.commands).where(eq(schema.commands.roomId, room.roomId)).orderBy(asc(schema.commands.acceptedRevision));
      await appendHistory(tx, room, stored);
      return 'ok';
    });
  }

  async listRoomIds(): Promise<string[]> {
    return (await this.db.select({ roomId: schema.rooms.roomId }).from(schema.rooms)).map(r => r.roomId);
  }

  async delete(roomId: string, expectedRevision: number): Promise<'ok' | 'stale'> {
    const deleted = await this.db.delete(schema.rooms)
      .where(and(eq(schema.rooms.roomId, roomId), eq(schema.rooms.revision, expectedRevision))).returning({ roomId: schema.rooms.roomId });
    return deleted.length === 0 ? 'stale' : 'ok';
  }
}

function roomColumns(room: Room) {
  return {
    hostPlayerId: room.hostPlayerId, seed: room.game?.seed ?? null,
    initialState: room.game?.initialState ?? null, state: room.game?.state ?? null,
    snapshotSchemaVersion: room.game?.state.schemaVersion ?? null, snapshotEngineVersion: room.game?.state.engineVersion ?? null,
  };
}
async function writeSeats(tx: Tx, room: Room) {
  if (room.seats.length === 0) return;
  await tx.insert(schema.seats).values(room.seats.map((s, seatIndex) => ({ roomId: room.roomId, seatIndex, ...s })));
}
/**
 * Appends commands/events not yet stored. History normally only grows; if the stored rows are not a prefix
 * of the room's history (a developer import replaced it, PR-046), the room's history is rewritten.
 */
async function appendHistory(tx: Tx, room: Room, stored: readonly { playerId: string; commandId: string }[]) {
  const history = room.game?.commands ?? [];
  const isPrefix = stored.length <= history.length && stored.every((s, i) => s.playerId === history[i]!.playerId && s.commandId === history[i]!.commandId);
  if (!isPrefix) {
    await tx.delete(schema.events).where(eq(schema.events.roomId, room.roomId));
    await tx.delete(schema.commands).where(eq(schema.commands.roomId, room.roomId));
  }
  const fresh = history.slice(isPrefix ? stored.length : 0);
  if (fresh.length === 0) return;
  await tx.insert(schema.commands).values(fresh.map(c => ({
    roomId: room.roomId, playerId: c.playerId, commandId: c.commandId, expectedRevision: c.expectedRevision,
    action: c.action, acceptedRevision: c.acceptedRevision,
  })));
  const rows = fresh.flatMap(c => c.events.map(event => ({ roomId: room.roomId, revision: c.acceptedRevision, index: event.index, event })));
  if (rows.length) await tx.insert(schema.events).values(rows);
}
