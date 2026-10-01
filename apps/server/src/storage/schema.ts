import { bigint, foreignKey, integer, jsonb, pgTable, primaryKey, text, unique } from 'drizzle-orm/pg-core';
import type { GameEvent, GameState } from '@vibe-rico/game-engine';

/**
 * PR-056 persistence (ARCHITECTURE "Storage and release"): rooms with versioned snapshots, seat token
 * hashes, deduplication results and event history. Child rows cascade with their room.
 */
export const rooms = pgTable('rooms', {
  roomId: text('room_id').primaryKey(),
  roomCode: text('room_code').notNull().unique(),
  hostPlayerId: text('host_player_id').notNull(),
  revision: integer('revision').notNull(),
  // Seeds are uint32 (up to 4294967295), beyond Postgres integer; bigint holds them exactly.
  seed: bigint('seed', { mode: 'number' }),
  initialState: jsonb('initial_state').$type<GameState>(),
  state: jsonb('state').$type<GameState>(),
  // Snapshot versions as columns, so incompatible saves are detectable without decoding (PR-059).
  snapshotSchemaVersion: text('snapshot_schema_version'),
  snapshotEngineVersion: text('snapshot_engine_version'),
});

export const seats = pgTable('seats', {
  roomId: text('room_id').notNull(),
  seatIndex: integer('seat_index').notNull(),
  playerId: text('player_id').notNull(),
  displayName: text('display_name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
}, t => [
  primaryKey({ columns: [t.roomId, t.playerId] }),
  unique('seats_room_seat_index').on(t.roomId, t.seatIndex),
  foreignKey({ columns: [t.roomId], foreignColumns: [rooms.roomId] }).onDelete('cascade'),
]);

/** Deduplication results (PROTOCOL.md step 3): one row per accepted (room, player, commandId). */
export const commands = pgTable('commands', {
  roomId: text('room_id').notNull(),
  playerId: text('player_id').notNull(),
  commandId: text('command_id').notNull(),
  expectedRevision: integer('expected_revision').notNull(),
  action: jsonb('action').notNull(),
  acceptedRevision: integer('accepted_revision').notNull(),
}, t => [
  primaryKey({ columns: [t.roomId, t.playerId, t.commandId] }),
  unique('commands_room_revision').on(t.roomId, t.acceptedRevision),
  foreignKey({ columns: [t.roomId], foreignColumns: [rooms.roomId] }).onDelete('cascade'),
]);

/** Ordered event history per accepted revision. */
export const events = pgTable('events', {
  roomId: text('room_id').notNull(),
  revision: integer('revision').notNull(),
  index: integer('event_index').notNull(),
  event: jsonb('event').$type<GameEvent>().notNull(),
}, t => [
  primaryKey({ columns: [t.roomId, t.revision, t.index] }),
  foreignKey({ columns: [t.roomId], foreignColumns: [rooms.roomId] }).onDelete('cascade'),
]);
