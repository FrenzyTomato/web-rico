import { useEffect, useRef } from 'react';
import type { PlayerBroadcast } from '@vibe-rico/protocol';
import type { Action } from '../actions/options.js';

/** Only act on this seat's server-issued production choice; never choose a bonus good. */
export function useAutoProduce(latest: PlayerBroadcast | null, roomId: string, enabled: boolean, connected: boolean, pending: boolean, submit: (action: Action) => void) {
  const attempted = useRef<string | null>(null);
  useEffect(() => {
    const legal = latest?.legalActions[0];
    if (!enabled || !connected || pending || !latest || legal?.phase !== 'craftsman-production' || !legal.factoryChoices.length) return;
    const key = `${roomId}:${latest.view.viewer.playerId}:${latest.revision}`;
    if (attempted.current === key) return;
    attempted.current = key;
    submit({ kind: 'produce', production: { accept: true, useFactory: legal.factoryChoices.includes(true) } });
  }, [latest, roomId, enabled, connected, pending, submit]);
}
