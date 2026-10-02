import { createPortal } from 'react-dom';
import { HudIcon } from '../layout/HudIcon.js';
import { t, useLanguage } from '../i18n/language.js';
import { useEffect, useState } from 'react';
import { ROLE } from '../i18n/terms.js';

const KEY = 'vibe-rico.settings';
export interface Settings { readonly reducedMotion: boolean }
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
  [ROLE.planter, t("每人可取一块种植园；选择者也可改取采石场")],
  [ROLE.recruiter, t("分发工人，并把工人分配到种植园和建筑")],
  [ROLE.builder, t("每人可建造一栋建筑；选择者便宜 1 金币，采石场再降价")],
  [ROLE.craftsman, t("有工人的种植园和生产建筑产出货物；选择者另得 1 个")],
  [ROLE.trader, t("每人可向交易所卖出一种货物；选择者多得 1 金币")],
  [ROLE.captain, t("依次把货物装上货船换取分数，最后多余货物需丢弃")],
  [ROLE.adventurer, t("选择者获得 1 金币（4–5 人游戏）")],
  [t("总督"), t("每轮最先选择角色的玩家，每轮顺时针轮换")],
  [t("运货分"), t("装船获得的分数，只有你自己能看到，终局时公开")],
];

export function SettingsPanel({ settings, onChange, iconOnly = false, open, onOpenChange, portalHost }: { settings: Settings; onChange: (s: Settings) => void; iconOnly?: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; portalHost?: HTMLElement | null }) {
  useLanguage();
  const content = <div className="settings-body">
        <label><input type="checkbox" checked={settings.reducedMotion} onChange={e => onChange({ reducedMotion: e.target.checked })} />{t(" 减少动画")}</label>
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
