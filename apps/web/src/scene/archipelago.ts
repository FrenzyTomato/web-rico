/** World-unit footprints include the painted coastline, not only the usable interior. */
export const MAIN_ISLAND = { width: 64, depth: 32 } as const;
export const PLAYER_ISLAND = { width: 15, depth: 16.875 } as const;
export const ARCHIPELAGO = { width: 100, depth: 76 } as const;
export const HOME_Z = 27;
export const PRIVATE_BOAT_Z = 8.7;

export const ISLAND_SEATS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  3: [[0, HOME_Z], [-17, -27], [17, -27]],
  4: [[0, HOME_Z], [-42, 0], [0, -27], [42, 0]],
  5: [[0, HOME_Z], [-42, 1.5], [-17, -27], [17, -27], [42, 1.5]],
};
