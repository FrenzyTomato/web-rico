declare const entityId: unique symbol;
export type IdKind = 'game' | 'player' | 'tile' | 'building' | 'role-card' | 'ship';
export type EntityId<K extends IdKind> = string & { readonly [entityId]: K };
export type GameId = EntityId<'game'>;
export type PlayerId = EntityId<'player'>;
export type TileId = EntityId<'tile'>;
export type BuildingId = EntityId<'building'>;
export type RoleCardId = EntityId<'role-card'>;
export type ShipId = EntityId<'ship'>;

/** No randomness or normalization: callers choose deterministic, unique IDs. */
export function createId<K extends IdKind>(_kind: K, value: string): EntityId<K> {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error('ID must be a nonblank string');
  return value as EntityId<K>;
}
