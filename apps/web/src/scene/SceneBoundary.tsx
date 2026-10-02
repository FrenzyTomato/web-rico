import { t, useLanguage } from '../i18n/language.js';
import { Component } from 'react';
import type { ReactNode } from 'react';

import { webglAvailable } from './webglSupport.js';
export { webglAvailable } from './webglSupport.js';

function Fallback() { useLanguage(); return <p role="note">{t("立体视图不可用，请使用下方的文字界面")}</p>; }

/**
 * Shows the 3D scene only with WebGL, and replaces it with a notice if it fails. The DOM client is
 * rendered outside this boundary, so its controls keep working either way (ARCHITECTURE "Presentation boundaries").
 */
export class SceneBoundary extends Component<{ children: ReactNode; webgl?: () => boolean }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed || !(this.props.webgl ?? webglAvailable)()) return <Fallback />;
    return this.props.children;
  }
}
