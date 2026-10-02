import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SceneBoundary } from './SceneBoundary.js';
import { cameraDistanceScale } from './Camera.js';
import { PLAYER_ISLAND as BOARD, MAIN_ISLAND, PRIVATE_BOAT_Z } from './archipelago.js';
import { seatPositions, TABLE } from './TableScene.js';

afterEach(cleanup);

describe('seat layout', () => {
  it.each([3, 4, 5])('%i players: coastlines fit the scene with sea channels, viewer in front, and islands never overlap', n => {
    const seats = Array.from({ length: n }, (_, i) => `p${i}`);
    for (const viewer of seats) {
      const layout = seatPositions(seats, viewer);
      expect(layout.map(s => s.playerId)).toEqual(seats);
      for (const s of layout) {
        expect(Math.abs(s.x) + BOARD.width / 2).toBeLessThanOrEqual(TABLE.width / 2);
        expect(s.z - BOARD.depth / 2).toBeGreaterThanOrEqual(-TABLE.depth / 2);
        expect(s.z + PRIVATE_BOAT_Z + 1.3).toBeLessThanOrEqual(TABLE.depth / 2);
      }
      // At least two world units of ocean between the entire painted island footprints.
      for (const s of layout) {
        expect(Math.abs(s.x) >= (MAIN_ISLAND.width + BOARD.width) / 2 + 2 ||
          Math.abs(s.z) >= (MAIN_ISLAND.depth + BOARD.depth) / 2 + 2).toBe(true);
      }
      const me = layout.find(s => s.playerId === viewer)!;
      expect(me.z).toBeCloseTo(Math.max(...layout.map(s => s.z)));
      // Clockwise seen from above (+y): the next seat after the viewer is to the viewer's left (−x).
      const next = layout[(seats.indexOf(viewer) + 1) % n]!;
      expect(next.x).toBeLessThan(0);
      // Axis-aligned boards must not overlap: separated along x or along z.
      for (const a of layout) for (const b of layout) {
        if (a !== b) expect(Math.abs(a.x - b.x) >= BOARD.width || Math.abs(a.z - b.z) >= BOARD.depth / 2 + BOARD.depth / 2 + 2).toBe(true);
      }
    }
  });
});

describe('camera fit', () => {
  it('backs away on narrow stages so side seats stay in view, within bounds', () => {
    expect(cameraDistanceScale(2)).toBe(1);
    expect(cameraDistanceScale(1.6)).toBe(1);
    expect(cameraDistanceScale(1)).toBeCloseTo(1.6);
    expect(cameraDistanceScale(0.5)).toBe(2);
  });
});

describe('scene boundary', () => {
  it('without WebGL shows a notice instead of the scene, and the DOM controls still work', () => {
    const scene = vi.fn(() => <p>scene</p>);
    const Scene = () => scene();
    const click = vi.fn();
    render(<><SceneBoundary webgl={() => false}><Scene /></SceneBoundary><button onClick={click}>行动</button></>);
    expect(screen.getByRole('note').textContent).toBe('立体视图不可用，请使用下方的文字界面');
    expect(scene).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('行动'));
    expect(click).toHaveBeenCalled();
  });

  it('a failing scene is replaced by the notice without breaking the rest of the page', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = () => { throw Error('context lost'); };
    const click = vi.fn();
    render(<><SceneBoundary webgl={() => true}><Boom /></SceneBoundary><button onClick={click}>行动</button></>);
    expect(screen.getByRole('note')).toBeTruthy();
    fireEvent.click(screen.getByText('行动'));
    expect(click).toHaveBeenCalled();
  });

  it('jsdom has no WebGL, so the default check chooses the fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(<SceneBoundary><p>scene</p></SceneBoundary>);
    expect(screen.getByRole('note')).toBeTruthy();
  });
});
