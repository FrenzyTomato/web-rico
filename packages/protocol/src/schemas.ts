import { z } from 'zod';
import type { BuildingId, BuildingType, GameCommand, Good, RoleCardId, ShipId, TileId } from '@vibe-rico/game-engine';

/** A gameplay action is an engine command without actorId; the server attaches identity from the session. */
export type PlayerAction = GameCommand extends infer C ? C extends GameCommand ? Omit<C, 'actorId'> : never : never;

export const PROTOCOL_VERSION = '1';

// Runtime lists mirror engine unions; test/protocol.test.ts checks they stay exhaustive.
export const GOODS = ['corn', 'fruit', 'sugar', 'tobacco', 'coffee'] as const satisfies readonly Good[];
export const BUILDING_TYPES = [
  'small-fruit-depot', 'small-sugar-mill', 'large-fruit-depot', 'large-sugar-mill',
  'large-tobacco-storage', 'large-coffee-roaster', 'small-market', 'hacienda', 'builders-yard',
  'small-warehouse', 'hospital', 'office', 'large-market', 'large-warehouse', 'factory', 'school',
  'harbor', 'wharf', 'fire-station', 'residence', 'fortress', 'customs-house', 'city-hall',
] as const satisfies readonly BuildingType[];

// IDs are only type-checked here; the engine validates every reference against current state.
const id = <T extends string>() => z.string() as unknown as z.ZodType<T>;
const good = z.enum(GOODS);
/** Display names are required: not empty or whitespace-only (user ruling 2026-10-01). */
const displayName = z.string().refine(s => s.trim().length > 0);

/**
 * Gameplay actions: engine commands without actorId. Strict objects reject extra keys, so a client
 * cannot submit identity or computed values (price, quantity, VP) — PROTOCOL.md "Envelope".
 */
const action = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('choose-role'), roleCardId: id<RoleCardId>() }),
  z.strictObject({ kind: z.literal('use-hacienda'), accept: z.boolean() }),
  z.strictObject({ kind: z.literal('plant'), choice: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('estate'), tileId: id<TileId>() }),
    z.strictObject({ kind: z.literal('quarry') }),
    z.strictObject({ kind: z.literal('decline') }),
  ]) }),
  z.strictObject({ kind: z.literal('use-hospital'), tileId: id<TileId>().nullable() }),
  z.strictObject({ kind: z.literal('recruit-worker'), accept: z.boolean() }),
  z.strictObject({ kind: z.literal('allocate-workers'), allocation: z.strictObject({
    countryside: z.array(z.strictObject({ tileId: id<TileId>(), occupied: z.boolean() })),
    buildings: z.array(z.strictObject({ buildingId: id<BuildingId>(), occupiedSlots: z.number() })),
    idleCount: z.number(),
  }) }),
  z.strictObject({ kind: z.literal('build'), purchase: z.strictObject({
    buildingTypeId: z.enum(BUILDING_TYPES), useAdvantage: z.boolean(), useSchool: z.boolean(),
  }).nullable() }),
  z.strictObject({ kind: z.literal('produce'), production: z.union([
    z.strictObject({ accept: z.literal(false) }),
    z.strictObject({ accept: z.literal(true), useFactory: z.boolean() }),
  ]) }),
  z.strictObject({ kind: z.literal('take-production-bonus'), good: good.nullable() }),
  z.strictObject({ kind: z.literal('trade'), sale: z.strictObject({
    good, useAdvantage: z.boolean(), useSmallMarket: z.boolean(), useLargeMarket: z.boolean(),
  }).nullable() }),
  z.strictObject({ kind: z.literal('load'), useHarbor: z.boolean(), shipment: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('cargo'), shipId: id<ShipId>(), good }),
    z.strictObject({ kind: z.literal('personal'), good }),
  ]) }),
  z.strictObject({ kind: z.literal('decline-wharf') }),
  z.strictObject({ kind: z.literal('retain'), warehouseTypes: z.array(good),
    retained: z.strictObject({ corn: z.number(), fruit: z.number(), sugar: z.number(), tobacco: z.number(), coffee: z.number() }) }),
  z.strictObject({ kind: z.literal('take-adventurer-coin'), accept: z.boolean() }),
]) satisfies z.ZodType<PlayerAction>;

/** PROTOCOL.md: `{ protocolVersion, roomId, commandId, expectedRevision, action }`. */
export const gameplayRequest = z.strictObject({
  protocolVersion: z.literal(PROTOCOL_VERSION), roomId: z.string(), commandId: z.string(),
  expectedRevision: z.number(), action,
});
/** ARCHITECTURE.md RoomCommands (create/join/leave/start) plus host close (PROTOCOL.md; user ruling 2026-10-01). */
export const roomRequest = z.strictObject({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  action: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('create-room'), displayName }),
    z.strictObject({ kind: z.literal('join-room'), roomCode: z.string(), displayName }),
    z.strictObject({ kind: z.literal('leave-room'), roomId: z.string() }),
    z.strictObject({ kind: z.literal('start-game'), roomId: z.string() }),
    z.strictObject({ kind: z.literal('close-room'), roomId: z.string() }),
  ]),
});
/** Reclaims a seat with its reconnect token (PROTOCOL.md "Rooms and recovery"). */
export const resumeRequest = z.strictObject({ protocolVersion: z.literal(PROTOCOL_VERSION), roomId: z.string(), token: z.string() });
export type GameplayRequest = z.infer<typeof gameplayRequest>;
export type ResumeRequest = z.infer<typeof resumeRequest>;
export type RoomRequest = z.infer<typeof roomRequest>;

export type ParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: 'VERSION_MISMATCH' | 'BAD_SCHEMA' };
function parser<T>(schema: z.ZodType<T>) {
  return (input: unknown): ParseResult<T> => {
    // A different declared version is VERSION_MISMATCH even if its shape differs from this version.
    const version = typeof input === 'object' && input !== null ? (input as { protocolVersion?: unknown }).protocolVersion : undefined;
    if (typeof version === 'string' && version !== PROTOCOL_VERSION) return { ok: false, code: 'VERSION_MISMATCH' };
    const result = schema.safeParse(input);
    return result.success ? { ok: true, value: result.data } : { ok: false, code: 'BAD_SCHEMA' };
  };
}
export const parseGameplayRequest = parser(gameplayRequest);
export const parseRoomRequest = parser(roomRequest);
export const parseResumeRequest = parser(resumeRequest);
