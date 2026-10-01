import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsPanel, useSettings } from './Settings.js';

function Harness() {
  const [settings, set] = useSettings();
  return <SettingsPanel settings={settings} onChange={set} />;
}
beforeEach(() => { localStorage.clear(); document.documentElement.className = ''; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('settings', () => {
  it('defaults reduced motion to the system preference and marks the document', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    render(<Harness />);
    expect((screen.getByLabelText('减少动画') as HTMLInputElement).checked).toBe(true);
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
  });

  it('saves a change and offers terminology help', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    render(<Harness />);
    act(() => { fireEvent.click(screen.getByLabelText('减少动画')); });
    expect(JSON.parse(localStorage.getItem('vibe-rico.settings')!)).toEqual({ reducedMotion: true });
    expect(screen.getByLabelText('术语说明').textContent).toContain('总督');
  });
});
