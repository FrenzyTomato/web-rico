import type { CSSProperties } from 'react';
import type { FinalScoreBreakdown } from '@vibe-rico/game-engine';
import { t, useLanguage } from '../i18n/language.js';
import { BUILDING } from '../i18n/terms.js';

const BONUSES = ['fire-station', 'residence', 'fortress', 'customs-house', 'city-hall'] as const;

/**
 * End-of-game result on the board: the winner, then one card per player with their total and where it came from
 * (shipping, buildings, large-building bonuses) as a split bar. Desktop lays cards side by side; phones stack them.
 * The full table stays in the timeline panel (ScoreView).
 */
export function FinalScores({ scores, names, colors, viewerId, lobbyHref, onShowMap }: {
  scores: readonly FinalScoreBreakdown[]; names: Readonly<Record<string, string>>; colors: Readonly<Record<string, string>>;
  viewerId: string; lobbyHref?: string | undefined; onShowMap: () => void;
}) {
  useLanguage();
  const ranked = [...scores].sort((a, b) => a.rank - b.rank);
  const top = Math.max(1, ...ranked.map(s => s.totalVp));
  const name = (id: string) => id === viewerId ? t('你') : names[id] ?? id;
  const winners = ranked.filter(s => s.rank === 1);
  // A shared first place is settled by coins + goods; show that line only when totals tie.
  const tied = (s: FinalScoreBreakdown) => ranked.some(o => o !== s && o.totalVp === s.totalVp);
  return (
    <section className="final-result" aria-label={t('最终计分')} style={{ '--players': ranked.length } as CSSProperties}>
      <header>
        <small>{t('游戏结束')}</small>
        <h2>{winners.some(w => w.playerId === viewerId) ? t('你赢了！') : t('{0} 获胜', [winners.map(w => name(w.playerId)).join(' · ')])}</h2>
      </header>
      <ol className="final-cards">
        {ranked.map(s => {
          const bonus = BONUSES.reduce((a, b) => a + s.bonuses[b], 0);
          const parts = [
            { key: 'ship', label: t('运货分'), value: s.earnedVp },
            { key: 'build', label: t('建筑分'), value: s.baseBuildingVp },
            { key: 'bonus', label: t('大型建筑奖励'), value: bonus },
          ];
          return <li key={s.playerId} className={`final-card${s.rank === 1 ? ' winner' : ''}${s.playerId === viewerId ? ' mine' : ''}`}>
            <span className="final-rank" aria-label={t('第 {0} 名', [s.rank])}>{s.rank}</span>
            <span className="medallion" style={{ background: colors[s.playerId] }} aria-hidden>{(names[s.playerId] ?? s.playerId).slice(0, 1)}</span>
            <span className="final-name">{name(s.playerId)}</span>
            <strong className="final-total">{s.totalVp}<small>{t(' 分')}</small></strong>
            <span className="final-bar" aria-hidden>{parts.map(p => p.value > 0 && <i key={p.key} className={p.key} style={{ width: `${(p.value / top) * 100}%` }} />)}</span>
            <dl className="final-parts">
              {parts.map(p => <div key={p.key} className={p.key}><dt>{p.label}</dt><dd>{p.value}</dd></div>)}
            </dl>
            {bonus > 0 && <p className="final-bonuses">{BONUSES.filter(b => s.bonuses[b] > 0).map(b => `${BUILDING[b]} +${s.bonuses[b]}`).join(' · ')}</p>}
            {tied(s) && <p className="final-tiebreak">{t('平局比较（金币+货物）')}: {s.tieBreakCoinsAndGoods}</p>}
          </li>;
        })}
      </ol>
      <div className="final-actions">
        <button onClick={onShowMap}>{t('查看最终地图')}</button>
        {lobbyHref && <a className="back-to-lobby" href={lobbyHref}>{t('返回大厅')}</a>}
      </div>
    </section>
  );
}
