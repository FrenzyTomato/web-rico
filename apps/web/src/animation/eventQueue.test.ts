import { describe, expect, it } from 'vitest';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import { createEventQueue } from './eventQueue.js';
import { effectFor } from './transitions.js';

const role = (revision: number, cardId: string, index = 0) => ({ kind: 'role-selected', revision, index, playerId: 'a', cardId, role: 'builder' });
const at = (revision: number, ...events: object[]) => ({ revision, events }) as unknown as Pick<PlayerBroadcast, 'revision' | 'events'>;

describe('TS-MOTION: event queue', () => {
  it('plays each effect once, in order, for its duration', () => {
    const q = createEventQueue(100);
    q.accept(at(0));
    q.accept(at(1, role(1, 'r1'), role(1, 'r2', 1)));
    expect(q.active(0)).toBe('role:r1');
    expect(q.active(99)).toBe('role:r1');
    expect(q.active(100)).toBe('role:r2');
    expect(q.active(200)).toBeNull();
    expect(q.busy()).toBe(false);
  });

  it('ignores duplicate and old broadcasts', () => {
    const q = createEventQueue(100);
    q.accept(at(0));
    q.accept(at(1, role(1, 'r1')));
    q.accept(at(1, role(1, 'r1')));
    q.accept(at(0, role(0, 'old')));
    expect(q.active(0)).toBe('role:r1');
    expect(q.active(100)).toBeNull();
  });

  it('a revision gap (missing events or a reconnect snapshot) drops pending effects and aligns', () => {
    const q = createEventQueue(100);
    q.accept(at(0));
    q.accept(at(1, role(1, 'r1'), role(1, 'r2', 1)));
    expect(q.active(0)).toBe('role:r1');
    q.accept(at(5));
    expect(q.active(10)).toBeNull();
    q.accept(at(6, role(6, 'r6')));
    expect(q.active(20)).toBe('role:r6');
  });

  it('new state during an animation queues behind it; a lagging backlog keeps only the newest', () => {
    const q = createEventQueue(100, 2);
    q.accept(at(0));
    q.accept(at(1, role(1, 'a')));
    expect(q.active(0)).toBe('role:a');
    q.accept(at(2, role(2, 'b'), role(2, 'c', 1), role(2, 'd', 2)));
    expect(q.active(50)).toBe('role:a');
    expect(q.active(100)).toBe('role:c');
    expect(q.active(200)).toBe('role:d');
  });

  it('skip ends the current effect and everything pending', () => {
    const q = createEventQueue(100);
    q.accept(at(0));
    q.accept(at(1, role(1, 'a'), role(1, 'b', 1)));
    q.active(0);
    q.skip();
    expect(q.busy()).toBe(false);
    expect(q.active(1)).toBeNull();
  });

  it('a zero duration (reduced motion) shows nothing', () => {
    const q = createEventQueue(0);
    q.accept(at(0));
    q.accept(at(1, role(1, 'a')));
    expect(q.active(0)).toBeNull();
  });

  it('maps events to on-table objects only', () => {
    expect(effectFor(role(1, 'r1') as never)).toBe('role:r1');
    expect(effectFor({ kind: 'goods-moved', revision: 1, index: 0, good: 'corn', quantity: 2, from: { kind: 'player', playerId: 'a' }, to: { kind: 'cargo-ship', shipId: 's4' } } as never)).toBe('ship:s4');
    expect(effectFor({ kind: 'phase-changed', revision: 1, index: 0, from: 'role-selection', to: 'builder-choice' } as never)).toBeNull();
  });
});
