import { beforeEach, describe, expect, it } from 'vitest';
import type { PlayerEvent } from '@vibe-rico/protocol';
import { setLanguage } from '../i18n/language.js';
import { moveNotice } from './moveNotice.js';

beforeEach(() => setLanguage('en'));
const names = { me: 'Ana', bot: 'Bot Bea', other: 'Bot Caio' };
const chose = { kind: 'role-selected', revision: 1, index: 0, playerId: 'bot', cardId: 'role-3', role: 'builder' } as unknown as PlayerEvent;
const built = { kind: 'building-built', revision: 2, index: 0, playerId: 'bot', building: { instanceId: 'b1', buildingTypeId: 'small-market', occupiedSlots: 0 } } as unknown as PlayerEvent;
const workers = (playerId: string) => ({ kind: 'workers-received', revision: 3, index: 0, playerId, quantity: 1, source: 'register' }) as unknown as PlayerEvent;

describe('move notice', () => {
  it("states another player's move as its title", () => {
    expect(moveNotice([chose, built], 'me', names)).toEqual({ title: 'Bot Bea chose Builder · Bot Bea built Small Market', groups: [] });
  });
  it('sums each player\'s hand-outs into one item', () => {
    expect(moveNotice([workers('bot'), workers('bot'), workers('me')], 'me', names)!.groups[0]!.items).toEqual(['Bot Bea +2', 'You +1']);
  });
  it('turns repeated hand-outs into one chip per player, calling the viewer "You"', () => {
    expect(moveNotice([workers('bot'), workers('me'), workers('other')], 'me', names))
      .toEqual({ title: 'Workers received', groups: [{ label: '', items: ['Bot Bea +1', 'You +1', 'Bot Caio +1'] }] });
  });
  it("stays quiet for the viewer's own moves and bookkeeping-only broadcasts", () => {
    expect(moveNotice([{ ...chose, playerId: 'me' } as PlayerEvent], 'me', names)).toBeNull();
    expect(moveNotice([], 'me', names)).toBeNull();
  });
});
