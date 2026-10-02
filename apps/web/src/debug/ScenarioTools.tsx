import { t, useLanguage } from '../i18n/language.js';
import { useState } from 'react';
import type { GameCommand, ReplayFailure, ReplayRecord } from '@vibe-rico/game-engine';
import type { LobbySocket } from '../network/socket.js';

type Exported = { ok: true; value: { replay: ReplayRecord; snapshot: string } } | { ok: false; code: string };
type Imported = { ok: true; value: { revision: number } } | { ok: false; code: string } | { ok: false; failure: ReplayFailure };

const describeFailure = (f: ReplayFailure) =>
  f.kind === 'rejected-command' ? t('第 {0} 条命令不符合规则', [f.index]) : t('回放数据不一致');

/**
 * Local development only: rendered behind `import.meta.env.DEV` (absent from production builds) and served
 * by a server started with VIBE_RICO_DEV_TOOLS=1. Shows full private state, so never enable it for players.
 */
export function ScenarioTools({ socket, roomId }: { socket: LobbySocket; roomId: string }) {
  useLanguage();
  const [exported, setExported] = useState<Exported | null>(null);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState<Imported | 'invalid' | null>(null);

  const exportRoom = async () => setExported(await socket.timeout(2000).emitWithAck('debug-export', { roomId }).catch(() => ({ ok: false as const, code: 'DEV_DISABLED' })));
  const importRoom = async () => {
    let replay: unknown;
    try { replay = JSON.parse(draft); } catch { return setResult('invalid'); }
    const reply: Imported = await socket.timeout(5000).emitWithAck('debug-import', { roomId, replay }).catch(() => ({ ok: false as const, code: 'DEV_DISABLED' }));
    if (reply.ok) { setResult(reply); location.reload(); return; }
    setResult(reply);
  };

  return (
    <details aria-label={t("开发工具")}>
      <summary>{t("开发工具（仅本地开发）")}</summary>
      <button onClick={() => void exportRoom()}>{t("导出历史与状态")}</button>
      {exported && (exported.ok ? (
        <>
          <ol aria-label={t("命令历史")}>{exported.value.replay.commands.map((c: GameCommand, i) => <li key={i}>{i + 1}：{c.actorId}</li>)}</ol>
          <label>{t("回放记录")}<textarea readOnly rows={6} value={JSON.stringify(exported.value.replay)} /></label>
          <label>{t("当前状态")}<textarea readOnly rows={6} value={exported.value.snapshot} /></label>
        </>
      ) : <p role="alert">{t("导出失败：")}{t('操作失败，请重试')}</p>)}
      <label>{t("导入回放记录")}<textarea rows={6} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <button onClick={() => void importRoom()}>{t("导入")}</button>
      {result && <p role="status">{result === 'invalid' ? t('不是有效的回放数据') : result.ok ? t('已导入，版本 {0}，正在刷新…', [result.value.revision]) : 'failure' in result ? describeFailure(result.failure) : t('操作失败，请重试')}</p>}
    </details>
  );
}
