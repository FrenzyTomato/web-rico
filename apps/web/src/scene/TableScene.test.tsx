import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SceneBoundary } from './SceneBoundary.js';
import { seatPositions, TABLE } from './TableScene.js';

afterEach(cleanup);

describe('seat layout', () => {
  it.each([3, 4, 5])('%i players: every seat on the table, viewer in front, clockwise, and well separated', n => {
    const seats = Array.from({ length: n }, (_, i) => `p${i}`);
    for (const viewer of seats) {
      const layout = seatPositions(seats, viewer);
      expect(layout.map(s => s.playerId)).toEqual(seats);
      for (const s of layout) expect(Math.abs(s.x) <= TABLE.width / 2 && Math.abs(s.z) <= TABLE.depth / 2).toBe(true);
      const me = layout.find(s => s.playerId === viewer)!;
      expect(me.z).toBeCloseTo(Math.max(...layout.map(s => s.z)));
      // Clockwise seen from above (+y): the next seat after the viewer is to the viewer's left (−x).
      const next = layout[(seats.indexOf(viewer) + 1) % n]!;
      expect(next.x).toBeLessThan(0);
      // Seat markers are 3×2; centres at least 3 apart keep names readable.
      for (const a of layout) for (const b of layout) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('scene boundary', () => {
  it('without WebGL shows a notice instead of the scene, and the DOM controls still work', () => {
    const scene = vi.fn(() => <p>scene</p>);
    const Scene = () => scene();
    const click = vi.fn();
    render(<><SceneBoundary webgl={() => false}><Scene /></SceneBoundary><button onClick={click}>行动</button></>);
    expect(screen.getByRole('note').textContent).toBe('3D 视图不可用，请使用下方的文字界面');
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
