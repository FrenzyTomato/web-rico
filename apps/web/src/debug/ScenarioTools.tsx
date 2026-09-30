import { useState } from 'react';
import type { GameCommand, ReplayFailure, ReplayRecord } from '@vibe-rico/game-engine';
import type { LobbySocket } from '../network/socket.js';

type Exported = { ok: true; value: { replay: ReplayRecord; snapshot: string } } | { ok: false; code: string };
type Imported = { ok: true; value: { revision: number } } | { ok: false; code: string } | { ok: false; failure: ReplayFailure };

const describeFailure = (f: ReplayFailure) =>
  f.kind === 'rejected-command' ? `第 ${f.index} 条命令被拒绝：${f.error.code}（${f.error.ruleId}）` : `${f.kind}：${f.path}`;

/**
 * Local development only: rendered behind `import.meta.env.DEV` (absent from production builds) and served
 * by a server started with VIBE_RICO_DEV_TOOLS=1. Shows full private state, so never enable it for players.
 */
export function ScenarioTools({ socket, roomId }: { socket: LobbySocket; roomId: string }) {
  const [exported, setExported] = useState<Exported | null>(null);
  const [draft, setDraft] = useState('');
  const [result, setResult] = useState('');

  const exportRoom = async () => setExported(await socket.timeout(2000).emitWithAck('debug-export', { roomId }).catch(() => ({ ok: false as const, code: '服务器未启用开发工具' })));
  const importRoom = async () => {
    let replay: unknown;
    try { replay = JSON.parse(draft); } catch { return setResult('不是有效的 JSON'); }
    const reply: Imported = await socket.timeout(5000).emitWithAck('debug-import', { roomId, replay }).catch(() => ({ ok: false as const, code: '服务器未启用开发工具' }));
    if (reply.ok) { setResult(`已导入，版本 ${reply.value.revision}，正在刷新…`); location.reload(); return; }
    setResult('failure' in reply ? describeFailure(reply.failure) : `导入失败：${reply.code}`);
  };

  return (
    <details aria-label="开发工具">
      <summary>开发工具（仅本地开发）</summary>
      <button onClick={() => void exportRoom()}>导出历史与状态</button>
      {exported && (exported.ok ? (
        <>
          <ol aria-label="命令历史">{exported.value.replay.commands.map((c: GameCommand, i) => <li key={i}>{i}：{c.actorId} {c.kind}</li>)}</ol>
          <label>回放记录<textarea readOnly rows={6} value={JSON.stringify(exported.value.replay)} /></label>
          <label>当前状态<textarea readOnly rows={6} value={exported.value.snapshot} /></label>
        </>
      ) : <p role="alert">导出失败：{exported.code}</p>)}
      <label>导入回放记录<textarea rows={6} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <button onClick={() => void importRoom()}>导入</button>
      {result && <p role="status">{result}</p>}
    </details>
  );
}
