import { t, useLanguage } from '../i18n/language.js';
import { useContext, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { ROLE_HELP } from '../i18n/roleHelp.js';
import type { PublicPlayerView, PlayerView } from '@vibe-rico/protocol';
import type { LegalAction } from '@vibe-rico/game-engine';
import { Interaction, targetKey } from '../scene/Selection.js';
import type { SceneTarget } from '../scene/Selection.js';
import { GOOD, ROLE } from '../i18n/terms.js';
import { GOODS_MODEL, ROLE_MODEL } from '../scene/modelCatalog.js';
import { GOODS } from '../actions/options.js';
import type { Action } from '../actions/options.js';

const imageUrl = (name: string) => `/art/dock/${encodeURIComponent(name)}.webp`;
/** Small cached portraits of the source pieces keep the persistent dock sharp without a second WebGL context. */
export function ResourceDock({ player, points }: { player: PublicPlayerView; points: number }) {
  useLanguage();
  const interaction = useContext(Interaction);
  const piece = (target: SceneTarget, model: string, label: string) => <button key={targetKey(target)} className={`dock-piece${target.kind === 'worker' ? ' dock-worker' : ''}`}
    aria-label={label} aria-pressed={interaction.selectedKey === targetKey(target)} disabled={!interaction.actionable(target)}
    onClick={() => interaction.select(target)} title={!interaction.inspect || interaction.inspect(target) ? label : undefined}>
    <img src={imageUrl(`${model} Cutout`)} alt="" draggable={false} />
  </button>;
  return <div className="dock-resources">
    <div className="dock-counters"><span>🪙 <strong>{player.coins}</strong></span><span>★ <strong>{points}</strong></span></div>
    <section className="dock-workers" aria-label={t("工人池")}><h3>{t("工人池 ")}<small>{player.idleWorkerCount}</small></h3>
      <div className="dock-pieces">{Array.from({ length: player.idleWorkerCount }, (_, index) => piece({ kind: 'worker', id: 'pool', index }, `Worker ${String(index % 5 + 1).padStart(2, '0')}`, t("选择工人 {0}", [index + 1])))}
      {player.idleWorkerCount === 0 && <span className="dock-empty">{t("无空闲工人")}</span>}</div>
    </section>
    <section className="dock-goods" aria-label={t("货物区")}><h3>{t("货物")}</h3><div className="dock-pieces">
      {GOODS.flatMap(good => Array.from({ length: player.goods[good] }, (_, index) => piece({ kind: 'crate', good, index }, GOODS_MODEL[good], t("{0}货箱 {1}", [GOOD[good], index + 1]))))}
      {!GOODS.some(g => player.goods[g]) && <span className="dock-empty">{t("生产的货物将出现在这里")}</span>}
    </div></section>
  </div>;
}
export function RoleHand({ legal, view, submit }: { legal: Extract<LegalAction, { phase: 'role-selection' }>; view: PlayerView; submit: (a: Action) => void }) {
  useLanguage();
  const tooltipId = useId();
  const [hint, setHint] = useState<{ id: string; left: number; bottom: number } | null>(null);
  const cardHint = view.roleCards.find(card => card.instanceId === hint?.id);
  const showHint = (id: string, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setHint({ id, left: Math.max(14, Math.min(rect.left, window.innerWidth - 344)), bottom: window.innerHeight - rect.top + 10 });
  };
  return <><div className="role-hand" role="group" aria-label={t("可选行动")}>
    {legal.roleCardIds.map((id, index) => { const card = view.roleCards.find(c => c.instanceId === id)!;
      return <button key={id} className="role-card"
        onMouseEnter={event => showHint(id, event.currentTarget)} onMouseLeave={() => setHint(null)}
        onFocus={event => showHint(id, event.currentTarget)} onBlur={() => setHint(null)}
        onKeyDown={event => { if (event.key === 'Escape') setHint(null); }}
        aria-describedby={hint?.id === id ? tooltipId : undefined} onClick={() => submit({ kind: 'choose-role', roleCardId: id })}
        aria-label={t("选择角色 {0}（{1} 金币，序号 {2}）", [ROLE[card.kind], card.accumulatedCoins, index + 1])}>
        <img src={imageUrl(`${ROLE_MODEL[card.kind]} Illustration`)} alt="" draggable={false} /><span>{ROLE[card.kind]}</span><small>🪙 {card.accumulatedCoins}</small>
      </button>;
    })}
  </div>{hint && cardHint && createPortal(<div id={tooltipId} className="model-tooltip" role="tooltip"
    style={{ position: 'fixed', top: 'auto', left: hint.left, right: 'auto', bottom: hint.bottom, zIndex: 100 }}>
    <strong>{ROLE[cardHint.kind]}</strong><p>{ROLE_HELP[cardHint.kind]}</p>
  </div>, document.body)}</>;
}
