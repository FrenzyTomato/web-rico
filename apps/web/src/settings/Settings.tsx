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
const GLOSSARY: readonly [string, string][] = [
  [ROLE.planter, '每人可取一块种植园；选择者也可改取采石场'],
  [ROLE.recruiter, '分发工人，并把工人分配到种植园和建筑'],
  [ROLE.builder, '每人可建造一栋建筑；选择者便宜 1 金币，采石场再降价'],
  [ROLE.craftsman, '有工人的种植园和生产建筑产出货物；选择者另得 1 个'],
  [ROLE.trader, '每人可向交易所卖出一种货物；选择者多得 1 金币'],
  [ROLE.captain, '依次把货物装上货船换取分数，最后多余货物需丢弃'],
  [ROLE.adventurer, '选择者获得 1 金币（4–5 人游戏）'],
  ['总督', '每轮最先选择角色的玩家，每轮顺时针轮换'],
  ['运货分', '装船获得的分数，只有你自己能看到，终局时公开'],
];

export function SettingsPanel({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <details className="settings">
      <summary>设置与帮助</summary>
      <div className="settings-body">
        <label><input type="checkbox" checked={settings.reducedMotion} onChange={e => onChange({ reducedMotion: e.target.checked })} /> 减少动画</label>
        <dl aria-label="术语说明">
          {GLOSSARY.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
        </dl>
      </div>
    </details>
  );
}
