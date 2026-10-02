import { AutoProduceHelp } from './AutoProduceHelp.js';
import { ROLE_HELP } from '../i18n/roleHelp.js';
import { createPortal } from 'react-dom';
import { HudIcon } from '../layout/HudIcon.js';
import { t, useLanguage } from '../i18n/language.js';
import { useEffect, useState } from 'react';
import { ROLE } from '../i18n/terms.js';

const KEY = 'vibe-rico.settings';
export interface Settings { readonly reducedMotion: boolean; readonly turnSound?: boolean; readonly autoProduce?: boolean }
const systemReduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Per-browser display settings; reduced motion defaults to the system preference. */
export function useSettings(): [Settings, (s: Settings) => void] {
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem(KEY);
    return saved ? JSON.parse(saved) as Settings : { reducedMotion: systemReduced() };
  });
  useEffect(() => { document.documentElement.classList.toggle('reduce-motion', settings.reducedMotion); }, [settings.reducedMotion]);
  return [settings, s => { localStorage.setItem(KEY, JSON.stringify(s)); setSettings(s); }];
}

/** Short terminology help (RULES.md roles and components), in the display language. */
const glossary = (): readonly [string, string][] => [
  [ROLE.planter, ROLE_HELP.planter],
  [ROLE.recruiter, ROLE_HELP.recruiter],
  [ROLE.builder, ROLE_HELP.builder],
  [ROLE.craftsman, ROLE_HELP.craftsman],
  [ROLE.trader, ROLE_HELP.trader],
  [ROLE.captain, ROLE_HELP.captain],
  [ROLE.adventurer, ROLE_HELP.adventurer],
  [t("总督"), t("每轮最先选择角色的玩家，每轮顺时针轮换")],
  [t("运货分"), t("装船获得的分数，只有你自己能看到，终局时公开")],
];

export function SettingsPanel({ settings, onChange, iconOnly = false, open, onOpenChange, portalHost }: { settings: Settings; onChange: (s: Settings) => void; iconOnly?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; portalHost?: HTMLElement | null }) {
  useLanguage();
  const content = <div className="settings-body">
        <label><input type="checkbox" checked={settings.reducedMotion} onChange={e => onChange({ ...settings, reducedMotion: e.target.checked })} />{t(" 减少动画")}</label>
        <label><input type="checkbox" checked={settings.turnSound ?? true} onChange={e => onChange({ ...settings, turnSound: e.target.checked })} />{t("回合提示音")}</label>
        <div className="setting-with-help"><label><input type="checkbox" checked={settings.autoProduce ?? false} onChange={e => onChange({ ...settings, autoProduce: e.target.checked })} />{t("自动生产（仅自己）")}</label><AutoProduceHelp /></div>
        <dl aria-label={t("术语说明")}>
          {glossary().map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
        </dl>
      </div>;
  return (
    <details className="settings" open={open}>
      <summary onClick={onOpenChange ? event => { event.preventDefault(); onOpenChange(!open); } : undefined} className={iconOnly ? "hud-icon" : undefined} aria-label={t("设置与帮助")} title={t("设置与帮助")}>{iconOnly ? <HudIcon kind="settings" /> : t("设置与帮助")}</summary>
      {portalHost ? (open ? createPortal(content, portalHost) : null) : content}
    </details>
  );
}
