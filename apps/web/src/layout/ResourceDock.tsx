import { t, useLanguage } from '../i18n/language.js';
import { useContext } from 'react';
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
    onClick={() => interaction.select(target)} title={label}>
    <img src={imageUrl(target.kind === 'worker' ? `${model} Cutout` : model)} alt="" draggable={false} />
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
  return <div className="role-hand" role="group" aria-label={t("可选行动")}>
    {legal.roleCardIds.map((id, index) => { const card = view.roleCards.find(c => c.instanceId === id)!;
      return <button key={id} className="role-card" onClick={() => submit({ kind: 'choose-role', roleCardId: id })}
        aria-label={t("选择角色 {0}（{1} 金币，序号 {2}）", [ROLE[card.kind], card.accumulatedCoins, index + 1])}>
        <img src={imageUrl(`${ROLE_MODEL[card.kind]} Illustration`)} alt="" draggable={false} /><span>{ROLE[card.kind]}</span><small>🪙 {card.accumulatedCoins}</small>
      </button>;
    })}
  </div>;
}
