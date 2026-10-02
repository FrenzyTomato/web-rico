import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PerspectiveCamera } from 'three';
import { useThree } from '@react-three/fiber';
import { Camera, boardFrame } from './Camera.js';

vi.mock('@react-three/fiber', () => ({ useThree: vi.fn() }));
vi.mock('@react-three/drei', async () => {
  const { forwardRef, useImperativeHandle, useMemo } = await import('react');
  const { Vector3 } = await import('three');
  return { OrbitControls: forwardRef(function Controls(_props, ref) {
    const controls = useMemo(() => ({ target: new Vector3(), update: vi.fn() }), []);
    useImperativeHandle(ref, () => controls);
    return null;
  }) };
});
afterEach(cleanup);

describe('board camera', () => {
  it('closer views enlarge content and narrow screens fit the requested area', () => {
    expect(boardFrame('shared', 1.6).distance).toBeLessThan(boardFrame('overview', 1.6).distance);
    expect(boardFrame('mine', 1.6).distance).toBeLessThan(boardFrame('shared', 1.6).distance);
    expect(boardFrame('buildings', 1.6).distance).toBeLessThan(boardFrame('shared', 1.6).distance);
    expect(boardFrame('shared', 0.6).distance).toBeGreaterThan(boardFrame('shared', 1.6).distance);
    expect(boardFrame('mine', 1.6).z).toBe(27.5);
  });
  it('zooms, focuses the viewer seat, and preserves manual navigation on game rerenders', () => {
    const camera = new PerspectiveCamera(45, 1.6, 0.1, 200);
    const state = { camera, size: { width: 1280, height: 800 }, invalidate: vi.fn() };
    vi.mocked(useThree).mockReturnValue(state as never);
    const first = { id: 0, view: 'shared' } as const;
    const ui = render(<Camera command={first} />);
    const initialY = camera.position.y - 0.4;
    ui.rerender(<Camera command={{ id: 1, zoom: 0.8 }} />);
    expect(camera.position.y - 0.4).toBeCloseTo(initialY * 0.8);
    const mine = { id: 2, view: 'mine' } as const;
    ui.rerender(<Camera command={mine} />);
    expect(camera.position.z).toBeGreaterThan(13);
    camera.position.x = 3; // User panned using OrbitControls.
    const before = camera.position.clone();
    ui.rerender(<Camera command={mine} />);
    expect(camera.position.toArray()).toEqual(before.toArray());
    ui.rerender(<Camera command={{ id: 3, view: 'mine' }} />);
    expect(camera.position.x).toBe(0); // Clicking the active preset resets it.
    const homePosition = camera.position.clone();
    ui.rerender(<Camera command={{ id: 4, view: 'mine', island: { x: -17, z: -27 } }} />);
    expect(camera.position.x).toBe(-17);
    expect(camera.position.y).toBeCloseTo(homePosition.y);
    expect(camera.position.z).toBeCloseTo(homePosition.z - 54);

  });
});
