import { describe, expect, it } from 'vitest';
import type { PlayerView } from '@vibe-rico/protocol';
import { actionView } from './actionView.js';

const view = (kind: string) => ({ phase: { kind }, viewer: { playerId: 'me' } }) as unknown as PlayerView;

describe('action camera', () => {
  it('uses the shortcut view where each decision is made', () => {
    expect(actionView(view('planter-choice'), true)).toEqual({ view: 'estates' });
    expect(actionView(view('builder-choice'), true)).toEqual({ view: 'buildings-1' });
    expect(actionView(view('trader-choice'), true)).toEqual({ view: 'depot' });
    expect(actionView(view('captain-loading'), true)).toEqual({ view: 'boats' });
    expect(actionView(view('recruiter-placement'), true)).toEqual({ view: 'mine', playerId: 'me' });
  });
  it('leaves the camera alone for role choice and for other players’ decisions', () => {
    expect(actionView(view('role-selection'), true)).toBeNull();
    expect(actionView(view('builder-choice'), false)).toBeNull();
  });
});
