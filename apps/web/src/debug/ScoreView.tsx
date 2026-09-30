import type { FinalScoreBreakdown } from '@vibe-rico/game-engine';
import { BUILDING } from '../i18n/terms.js';

const BONUSES = ['fire-station', 'residence', 'fortress', 'customs-house', 'city-hall'] as const;

/** Itemized final scoring exactly as the server computed it (SCORE-001/002). */
export function ScoreView({ scores, names }: { scores: readonly FinalScoreBreakdown[]; names: Readonly<Record<string, string>> }) {
  return (
    <table aria-label="最终计分">
      <thead><tr><th>名次</th><th>玩家</th><th>运货分</th><th>建筑分</th>{BONUSES.map(b => <th key={b}>{BUILDING[b]}</th>)}<th>总分</th><th>平局比较（金币+货物）</th></tr></thead>
      <tbody>
        {[...scores].sort((a, b) => a.rank - b.rank).map(s => (
          <tr key={s.playerId}>
            <td>{s.rank}</td><td>{names[s.playerId] ?? s.playerId}</td><td>{s.earnedVp}</td><td>{s.baseBuildingVp}</td>
            {BONUSES.map(b => <td key={b}>{s.bonuses[b]}</td>)}<td>{s.totalVp}</td><td>{s.tieBreakCoinsAndGoods}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
