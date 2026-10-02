import { HudIcon } from '../layout/HudIcon.js';
import { useSyncExternalStore } from 'react';
import { EN } from './en.js';

export type Language = 'zh' | 'en';
const KEY = 'vibe-rico.language';
function savedLanguage(): Language {
  try { return localStorage.getItem(KEY) === 'zh' ? 'zh' : 'en'; } catch { return 'en'; }
}
let language = savedLanguage();
const listeners = new Set<() => void>();
export const getLanguage = () => language;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

function updateDocument() {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = 'Web Rico';
}
updateDocument();
export function setLanguage(next: Language) {
  if (next === language) return;
  language = next;
  try { localStorage.setItem(KEY, next); } catch { /* Language still works when storage is disabled. */ }
  updateDocument();
  listeners.forEach(listener => listener());
}
export function useLanguage() { return useSyncExternalStore(subscribe, getLanguage, () => 'en' as const); }

/** Translate UI text only; interpolate names and codes without modifying user content. */
export function t(source: keyof typeof EN, values: readonly (string | number)[] = [], locale = language): string {
  const message = locale === 'en' ? (EN as Readonly<Record<string, string>>)[source] ?? source : source;
  return message.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)] ?? `{${index}}`));
}

/** Accessible names stay localized; the optional translation symbol is language-neutral. */
export function LanguageToggle({ iconOnly = false }: { iconOnly?: boolean }) {
  const current = useLanguage();
  return <button className={iconOnly ? "language-toggle hud-icon" : "language-toggle"} aria-label={t('切换为英文')} title={t('切换为英文')} onClick={() => setLanguage(current === 'zh' ? 'en' : 'zh')}>
    {iconOnly ? <HudIcon kind="language" /> : t('切换为英文')}
  </button>;
}
