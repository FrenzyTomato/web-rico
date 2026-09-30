import { Component } from 'react';
import type { ReactNode } from 'react';

export function webglAvailable(): boolean {
  const canvas = document.createElement('canvas');
  return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
}
const FALLBACK = <p role="note">3D 视图不可用，请使用下方的文字界面</p>;

/**
 * Shows the 3D scene only with WebGL, and replaces it with a notice if it fails. The DOM client is
 * rendered outside this boundary, so its controls keep working either way (ARCHITECTURE "Presentation boundaries").
 */
export class SceneBoundary extends Component<{ children: ReactNode; webgl?: () => boolean }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed || !(this.props.webgl ?? webglAvailable)()) return FALLBACK;
    return this.props.children;
  }
}
