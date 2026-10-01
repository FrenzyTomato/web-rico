// Development-only visual fixture page (not in the production build): /scene-preview.html?game=5p&at=120
// Renders the scene for any revision of a frozen PR-036 history, so empty/full/exhausted states can be checked.
import '@fontsource/cormorant-garamond/600.css';
import '../styles.css';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { liveTextures, sharedCounts } from './resources.js';
import { applyCommand, createGame } from '@vibe-rico/game-engine';
import type { CreateGameInput, GameCommand, GameState } from '@vibe-rico/game-engine';
import type { PlayerView } from '@vibe-rico/protocol';
import * as three from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-3p.js';
import * as four from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-4p.js';
import * as five from '../../../../packages/game-engine/test/scenarios/fixtures/full-game-5p.js';
import { TableScene } from './TableScene.js';

const params = new URLSearchParams(location.search);
const fixture = { '3p': three, '4p': four, '5p': five }[params.get('game') ?? '3p']!;
const created = createGame(fixture.input as unknown as CreateGameInput);
if (!created.ok) throw Error(created.error.message);
let state: GameState = created.state;
const at = Math.min(Number(params.get('at') ?? fixture.commands.length), fixture.commands.length);
for (const c of fixture.commands.slice(0, at)) { const r = applyCommand(state, c as GameCommand); if (!r.ok) throw Error(r.error.message); state = r.state; }
const viewer = state.seatOrder[0]!;
const view: PlayerView = {
  viewer: { playerId: viewer, earnedVp: state.players[0]!.earnedVp }, seatOrder: state.seatOrder,
  players: state.players.map(({ earnedVp: _, ...p }) => p), governorPlayerId: state.governorPlayerId, roundNumber: state.roundNumber,
  roleSelectionIndex: state.roleSelectionIndex, roleCards: state.roleCards, phase: state.phase, supply: state.supply,
  estateMarket: state.estateMarket, estateDiscard: state.estateDiscard, endTriggers: state.endTriggers, ships: state.ships, tradingHouse: state.tradingHouse,
};
const names = Object.fromEntries(state.seatOrder.map(id => [id, id]));
/** `?bench=1`: continuous rendering for 3 s, p95 frame time in window.__bench (docs/PERFORMANCE.md). */
function Bench() {
  useEffect(() => {
    const deltas: number[] = [];
    let last = performance.now(), stop = false;
    const start = last;
    const frame = (now: number) => {
      if (now - start > 1000) deltas.push(now - last); // skip 1 s warm-up
      last = now;
      if (now - start < 4000 && !stop) requestAnimationFrame(frame);
      else {
        const sorted = [...deltas].sort((a, b) => a - b);
        (window as unknown as { __bench: unknown }).__bench = { frames: sorted.length, p50: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.floor(sorted.length * 0.95)] };
      }
    };
    requestAnimationFrame(frame);
    return () => { stop = true; };
  }, []);
  return <TableScene view={view} names={names} frameloop="always" />;
}

/** `?cycles=N`: mount and unmount the scene N times, sampling resources after each exit (window.__cycles). */
function Cycles({ n }: { n: number }) {
  const [shown, setShown] = useState(true);
  const [done, setDone] = useState(0);
  useEffect(() => {
    if (done >= n) return;
    const t = setTimeout(() => {
      if (shown) { setShown(false); return; }
      const heap = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null;
      const w = window as unknown as { __cycles?: unknown[] };
      (w.__cycles ??= []).push({ textures: liveTextures.count, canvases: document.querySelectorAll('canvas').length, heap, ...sharedCounts() });
      setDone(d => d + 1); setShown(true);
    }, 400);
    return () => clearTimeout(t);
  }, [shown, done, n]);
  return shown && done < n ? <TableScene view={view} names={names} /> : <p>cycles {done}/{n}</p>;
}

const cycles = Number(params.get('cycles') ?? 0);
createRoot(document.getElementById('root')!).render(
  <div style={{ height: '100vh' }}>
    <p>{params.get('game') ?? '3p'} · 版本 {state.revision} · {state.phase.kind}</p>
    {params.get('bench') ? <Bench /> : cycles ? <Cycles n={cycles} /> : <TableScene view={view} names={names} />}
  </div>,
);
