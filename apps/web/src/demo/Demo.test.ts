import { describe, expect, it } from 'vitest';
import type { GameplayRequest } from '@vibe-rico/protocol';
import { createDemoStore } from './Demo.js';

describe('view-only demo', () => {
  it('has developed islands, goods and loaded ships without legal actions', () => {
    const { latest, connected } = createDemoStore().getState();
    expect(connected).toBe(false);
    expect(latest!.legalActions).toEqual([]);
    expect(latest!.view.players).toHaveLength(3);
    expect(latest!.view.players.every(p => p.buildings.length > 0 && p.countryside.length > 0)).toBe(true);
    expect(latest!.view.ships.some(s => s.loadedCount > 0)).toBe(true);
  });
  it('cannot submit commands or acquire a live session', () => {
    const store = createDemoStore();
    const before = structuredClone(store.getState().latest);
    store.getState().sessionReady();
    expect(store.getState().submit('demo', { kind: 'choose-role', roleCardId: 'role-1' } as GameplayRequest['action'])).toBeNull();
    expect(store.getState().connected).toBe(false);
    expect(store.getState().pending).toEqual({});
    expect(store.getState().latest).toEqual(before);
  });
});
